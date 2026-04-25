
-- Vendor competitor alerts: déclenche quand un concurrent MediKong dépasse (passe devant) le vendeur sur un EAN
CREATE TABLE IF NOT EXISTS public.vendor_competitor_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'BE',
  my_offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  my_price NUMERIC NOT NULL,
  competitor_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  competitor_price NUMERIC NOT NULL,
  previous_rank INTEGER,
  current_rank INTEGER NOT NULL,
  total_competitors INTEGER NOT NULL DEFAULT 0,
  gap_amount NUMERIC NOT NULL DEFAULT 0,
  gap_percentage NUMERIC NOT NULL DEFAULT 0,
  suggested_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'new', -- new | seen | resolved | dismissed
  read_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, product_id, country_code, status) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_vca_vendor_status ON public.vendor_competitor_alerts(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_vca_product ON public.vendor_competitor_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_vca_created ON public.vendor_competitor_alerts(created_at DESC);

ALTER TABLE public.vendor_competitor_alerts ENABLE ROW LEVEL SECURITY;

-- Vendors can view their own alerts
CREATE POLICY "Vendors can view their own competitor alerts"
ON public.vendor_competitor_alerts
FOR SELECT
USING (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  OR public.is_admin(auth.uid())
);

-- Vendors can update status of their alerts
CREATE POLICY "Vendors can update their own competitor alerts"
ON public.vendor_competitor_alerts
FOR UPDATE
USING (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  OR public.is_admin(auth.uid())
);

-- Admins can manage all
CREATE POLICY "Admins manage competitor alerts"
ON public.vendor_competitor_alerts
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_vca_updated_at
BEFORE UPDATE ON public.vendor_competitor_alerts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Detection function : pour chaque vendeur+EAN où il n'est plus #1, créer/mettre à jour une alerte
CREATE OR REPLACE FUNCTION public.detect_vendor_competitor_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_created INTEGER := 0;
  v_updated INTEGER := 0;
  v_resolved INTEGER := 0;
  r RECORD;
  v_existing_id UUID;
  v_existing_rank INTEGER;
BEGIN
  -- Boucle sur tous les vendeurs ayant des offres actives avec >= 1 concurrent
  FOR r IN
    WITH all_active AS (
      SELECT o.id AS offer_id, o.product_id, o.country_code, o.vendor_id, o.price_excl_vat
      FROM offers o
      WHERE o.is_active = true AND o.price_excl_vat > 0
    ),
    ranked AS (
      SELECT
        a.vendor_id,
        a.product_id,
        a.country_code,
        a.offer_id,
        a.price_excl_vat AS my_price,
        (SELECT COUNT(*) + 1 FROM all_active a2
          WHERE a2.product_id = a.product_id AND a2.country_code = a.country_code
            AND a2.price_excl_vat < a.price_excl_vat) AS my_rank,
        (SELECT COUNT(*) FROM all_active a3
          WHERE a3.product_id = a.product_id AND a3.country_code = a.country_code
            AND a3.vendor_id <> a.vendor_id) AS competitors_count,
        (SELECT MIN(a4.price_excl_vat) FROM all_active a4
          WHERE a4.product_id = a.product_id AND a4.country_code = a.country_code
            AND a4.vendor_id <> a.vendor_id) AS best_competitor_price,
        (SELECT a5.vendor_id FROM all_active a5
          WHERE a5.product_id = a.product_id AND a5.country_code = a.country_code
            AND a5.vendor_id <> a.vendor_id
          ORDER BY a5.price_excl_vat ASC LIMIT 1) AS best_competitor_vendor_id
      FROM all_active a
    )
    SELECT * FROM ranked
    WHERE competitors_count >= 1
  LOOP
    -- Vendeur n'est PAS #1 → alerte (concurrent devant)
    IF r.my_rank > 1 AND r.best_competitor_price IS NOT NULL AND r.best_competitor_price < r.my_price THEN
      SELECT id, current_rank INTO v_existing_id, v_existing_rank
      FROM vendor_competitor_alerts
      WHERE vendor_id = r.vendor_id AND product_id = r.product_id
        AND country_code = r.country_code AND status IN ('new','seen')
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        UPDATE vendor_competitor_alerts SET
          my_offer_id = r.offer_id,
          my_price = r.my_price,
          competitor_vendor_id = r.best_competitor_vendor_id,
          competitor_price = r.best_competitor_price,
          previous_rank = COALESCE(v_existing_rank, previous_rank),
          current_rank = r.my_rank,
          total_competitors = r.competitors_count,
          gap_amount = ROUND((r.my_price - r.best_competitor_price)::numeric, 2),
          gap_percentage = ROUND(((r.my_price - r.best_competitor_price) / r.best_competitor_price * 100)::numeric, 1),
          suggested_price = ROUND((r.best_competitor_price * 0.99)::numeric, 2),
          updated_at = now()
        WHERE id = v_existing_id;
        v_updated := v_updated + 1;
      ELSE
        INSERT INTO vendor_competitor_alerts (
          vendor_id, product_id, country_code, my_offer_id, my_price,
          competitor_vendor_id, competitor_price, current_rank, total_competitors,
          gap_amount, gap_percentage, suggested_price, status
        ) VALUES (
          r.vendor_id, r.product_id, r.country_code, r.offer_id, r.my_price,
          r.best_competitor_vendor_id, r.best_competitor_price, r.my_rank, r.competitors_count,
          ROUND((r.my_price - r.best_competitor_price)::numeric, 2),
          ROUND(((r.my_price - r.best_competitor_price) / r.best_competitor_price * 100)::numeric, 1),
          ROUND((r.best_competitor_price * 0.99)::numeric, 2),
          'new'
        );
        v_created := v_created + 1;
      END IF;
    -- Vendeur est #1 → résoudre les alertes ouvertes
    ELSIF r.my_rank = 1 THEN
      UPDATE vendor_competitor_alerts
      SET status = 'resolved', resolved_at = now(), updated_at = now()
      WHERE vendor_id = r.vendor_id AND product_id = r.product_id
        AND country_code = r.country_code AND status IN ('new','seen');
      IF FOUND THEN v_resolved := v_resolved + 1; END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'alerts_created', v_created,
    'alerts_updated', v_updated,
    'alerts_resolved', v_resolved
  );
END;
$$;
