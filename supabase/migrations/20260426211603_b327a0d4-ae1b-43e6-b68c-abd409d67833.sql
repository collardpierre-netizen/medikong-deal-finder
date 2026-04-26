CREATE TABLE IF NOT EXISTS public.vendor_offer_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  country_code  text NOT NULL DEFAULT 'BE',
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  my_price      numeric(10,2),
  best_price    numeric(10,2),
  median_price  numeric(10,2),
  my_rank       integer,
  total_offers  integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, product_id, country_code, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_voh_vendor_product_date
  ON public.vendor_offer_history (vendor_id, product_id, snapshot_date DESC);

ALTER TABLE public.vendor_offer_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors read own offer history" ON public.vendor_offer_history;
CREATE POLICY "Vendors read own offer history"
  ON public.vendor_offer_history FOR SELECT
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins read all offer history" ON public.vendor_offer_history;
CREATE POLICY "Admins read all offer history"
  ON public.vendor_offer_history FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.snapshot_vendor_offer_history()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH all_active AS (
    SELECT o.product_id, o.country_code, o.vendor_id, o.price_excl_vat
    FROM offers o
    WHERE o.is_active = true AND o.price_excl_vat > 0
  ),
  agg AS (
    SELECT
      a.vendor_id, a.product_id, a.country_code,
      a.price_excl_vat AS my_price,
      MIN(a2.price_excl_vat) AS best_price,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a2.price_excl_vat) AS median_price,
      COUNT(a2.*) AS total_offers,
      (SELECT COUNT(*) + 1 FROM all_active a3
        WHERE a3.product_id = a.product_id
          AND a3.country_code = a.country_code
          AND a3.price_excl_vat < a.price_excl_vat) AS my_rank
    FROM all_active a
    JOIN all_active a2
      ON a2.product_id = a.product_id AND a2.country_code = a.country_code
    GROUP BY a.vendor_id, a.product_id, a.country_code, a.price_excl_vat
  )
  INSERT INTO public.vendor_offer_history
    (vendor_id, product_id, country_code, snapshot_date,
     my_price, best_price, median_price, my_rank, total_offers)
  SELECT
    vendor_id, product_id, country_code, CURRENT_DATE,
    ROUND(my_price::numeric, 2),
    ROUND(best_price::numeric, 2),
    ROUND(median_price::numeric, 2),
    my_rank::integer,
    total_offers::integer
  FROM agg
  ON CONFLICT (vendor_id, product_id, country_code, snapshot_date)
  DO UPDATE SET
    my_price     = EXCLUDED.my_price,
    best_price   = EXCLUDED.best_price,
    median_price = EXCLUDED.median_price,
    my_rank      = EXCLUDED.my_rank,
    total_offers = EXCLUDED.total_offers;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  DELETE FROM public.vendor_offer_history
  WHERE snapshot_date < CURRENT_DATE - INTERVAL '180 days';

  RETURN jsonb_build_object('rows', v_inserted, 'date', CURRENT_DATE);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_offer_history_30d(
  _vendor_id uuid,
  _product_id uuid,
  _country_code text DEFAULT 'BE'
)
RETURNS TABLE (
  snapshot_date date,
  my_price numeric,
  best_price numeric,
  median_price numeric,
  my_rank integer,
  total_offers integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT snapshot_date, my_price, best_price, median_price, my_rank, total_offers
  FROM public.vendor_offer_history
  WHERE vendor_id = _vendor_id
    AND product_id = _product_id
    AND country_code = _country_code
    AND snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
  ORDER BY snapshot_date ASC;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('snapshot-vendor-offer-history-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'snapshot-vendor-offer-history-daily',
  '0 3 * * *',
  $$ SELECT public.snapshot_vendor_offer_history(); $$
);