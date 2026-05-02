CREATE TABLE IF NOT EXISTS public.market_delta_anomalies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid NOT NULL,
  detected_at     timestamptz NOT NULL DEFAULT now(),
  offer_id        uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  vendor_id       uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  mk_pack_size    integer NOT NULL,
  mk_unit_price   numeric(12,4) NOT NULL,
  market_unit_price_median numeric(12,4) NOT NULL,
  market_sample_size integer NOT NULL,
  delta_abs       numeric(12,4) NOT NULL,
  delta_pct       numeric(8,4) NOT NULL,
  direction       text NOT NULL CHECK (direction IN ('mk_higher','mk_lower')),
  threshold_pct   numeric(6,4) NOT NULL,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','ignored','fixed')),
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           text
);

CREATE INDEX IF NOT EXISTS idx_market_delta_anomalies_run ON public.market_delta_anomalies(run_id);
CREATE INDEX IF NOT EXISTS idx_market_delta_anomalies_status_detected ON public.market_delta_anomalies(status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_delta_anomalies_product ON public.market_delta_anomalies(product_id);
CREATE INDEX IF NOT EXISTS idx_market_delta_anomalies_vendor ON public.market_delta_anomalies(vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_market_delta_anomalies_run_offer ON public.market_delta_anomalies(run_id, offer_id);

ALTER TABLE public.market_delta_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read market delta anomalies" ON public.market_delta_anomalies;
CREATE POLICY "admins read market delta anomalies"
ON public.market_delta_anomalies FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admins update market delta anomalies" ON public.market_delta_anomalies;
CREATE POLICY "admins update market delta anomalies"
ON public.market_delta_anomalies FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.market_delta_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  threshold_pct   numeric(6,4) NOT NULL,
  offers_scanned  integer NOT NULL DEFAULT 0,
  offers_with_market integer NOT NULL DEFAULT 0,
  anomalies_found integer NOT NULL DEFAULT 0,
  triggered_by    text NOT NULL DEFAULT 'cron',
  error           text
);

ALTER TABLE public.market_delta_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read market delta runs" ON public.market_delta_runs;
CREATE POLICY "admins read market delta runs"
ON public.market_delta_runs FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.detect_market_delta_anomalies(
  _threshold_pct numeric DEFAULT 0.15,
  _triggered_by  text    DEFAULT 'manual'
)
RETURNS TABLE(run_id uuid, anomalies_found integer, offers_scanned integer, offers_with_market integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid := gen_random_uuid();
  v_scanned integer := 0;
  v_with_market integer := 0;
  v_found integer := 0;
BEGIN
  IF _threshold_pct IS NULL OR _threshold_pct <= 0 THEN
    RAISE EXCEPTION 'threshold_pct must be > 0';
  END IF;

  INSERT INTO public.market_delta_runs(id, threshold_pct, triggered_by)
  VALUES (v_run_id, _threshold_pct, COALESCE(_triggered_by,'manual'));

  WITH ext AS (
    SELECT
      eo.product_id,
      eo.unit_price::numeric / GREATEST(COALESCE(NULLIF(eo.pack_size_override,0), p.pack_size, 1), 1) AS ext_unit_price
    FROM public.external_offers eo
    JOIN public.products p ON p.id = eo.product_id
    WHERE eo.is_active = true
      AND eo.unit_price IS NOT NULL
      AND eo.unit_price > 0
  ),
  ext_agg AS (
    SELECT product_id,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY ext_unit_price)::numeric(12,4) AS market_median,
           COUNT(*)::int AS sample_size
    FROM ext
    GROUP BY product_id
  ),
  mk AS (
    SELECT
      o.id AS offer_id,
      o.product_id,
      o.vendor_id,
      GREATEST(COALESCE(p.pack_size, 1), 1) AS mk_pack,
      (o.price_excl_vat::numeric / GREATEST(COALESCE(p.pack_size,1),1))::numeric(12,4) AS mk_unit_price
    FROM public.offers o
    JOIN public.products p ON p.id = o.product_id
    WHERE o.is_active = true
      AND o.price_excl_vat IS NOT NULL
      AND o.price_excl_vat > 0
  ),
  scan AS (
    SELECT
      mk.offer_id, mk.product_id, mk.vendor_id, mk.mk_pack, mk.mk_unit_price,
      ext_agg.market_median, ext_agg.sample_size,
      (mk.mk_unit_price - ext_agg.market_median) AS delta_abs,
      ((mk.mk_unit_price - ext_agg.market_median) / NULLIF(ext_agg.market_median,0)) AS delta_pct
    FROM mk
    LEFT JOIN ext_agg ON ext_agg.product_id = mk.product_id
  ),
  ins AS (
    INSERT INTO public.market_delta_anomalies(
      run_id, offer_id, product_id, vendor_id,
      mk_pack_size, mk_unit_price,
      market_unit_price_median, market_sample_size,
      delta_abs, delta_pct, direction, threshold_pct
    )
    SELECT
      v_run_id, s.offer_id, s.product_id, s.vendor_id,
      s.mk_pack, s.mk_unit_price,
      s.market_median, s.sample_size,
      s.delta_abs, s.delta_pct,
      CASE WHEN s.delta_pct >= 0 THEN 'mk_higher' ELSE 'mk_lower' END,
      _threshold_pct
    FROM scan s
    WHERE s.market_median IS NOT NULL
      AND ABS(s.delta_pct) >= _threshold_pct
    ON CONFLICT (run_id, offer_id) DO NOTHING
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*) FROM mk),
    (SELECT COUNT(*) FROM scan WHERE market_median IS NOT NULL),
    (SELECT COUNT(*) FROM ins)
  INTO v_scanned, v_with_market, v_found;

  UPDATE public.market_delta_runs
  SET finished_at = now(),
      offers_scanned = v_scanned,
      offers_with_market = v_with_market,
      anomalies_found = v_found
  WHERE id = v_run_id;

  RETURN QUERY SELECT v_run_id, v_found, v_scanned, v_with_market;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_market_delta_anomalies(numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_market_delta_anomalies(numeric, text) TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_notifications'
      AND column_name='vendor_id' AND is_nullable='NO'
  ) THEN
    ALTER TABLE public.vendor_notifications ALTER COLUMN vendor_id DROP NOT NULL;
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.run_market_delta_anomaly_job(
  _threshold_pct numeric DEFAULT 0.15,
  _triggered_by  text    DEFAULT 'cron'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_top jsonb;
BEGIN
  SELECT * INTO r FROM public.detect_market_delta_anomalies(_threshold_pct, _triggered_by);

  IF r.anomalies_found > 0 THEN
    SELECT jsonb_agg(t) INTO v_top FROM (
      SELECT a.product_id, a.offer_id, a.vendor_id,
             a.mk_unit_price, a.market_unit_price_median,
             a.delta_pct, a.direction
      FROM public.market_delta_anomalies a
      WHERE a.run_id = r.run_id
      ORDER BY ABS(a.delta_pct) DESC
      LIMIT 20
    ) t;

    INSERT INTO public.vendor_notifications(vendor_id, type, title, body, payload, cta_url)
    VALUES (
      NULL,
      'market_delta_anomalies',
      format('%s écart(s) prix anormaux détectés (≥ %s%%)',
             r.anomalies_found, ROUND(_threshold_pct*100)::text),
      format('Run %s — %s offres scannées, %s avec marché.',
             r.run_id, r.offers_scanned, r.offers_with_market),
      jsonb_build_object(
        'run_id', r.run_id,
        'threshold_pct', _threshold_pct,
        'anomalies_found', r.anomalies_found,
        'offers_scanned', r.offers_scanned,
        'offers_with_market', r.offers_with_market,
        'top', COALESCE(v_top, '[]'::jsonb)
      ),
      '/admin/market-delta-anomalies?run=' || r.run_id::text
    );
  END IF;

  RETURN jsonb_build_object(
    'run_id', r.run_id,
    'anomalies_found', r.anomalies_found,
    'offers_scanned', r.offers_scanned,
    'offers_with_market', r.offers_with_market,
    'threshold_pct', _threshold_pct
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_market_delta_anomaly_job(numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_market_delta_anomaly_job(numeric, text) TO authenticated, service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('market-delta-anomalies-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'market-delta-anomalies-daily',
  '30 4 * * *',
  $$ SELECT public.run_market_delta_anomaly_job(0.15, 'cron'); $$
);