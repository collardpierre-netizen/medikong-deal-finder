CREATE TABLE public.vendor_price_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('global', 'ean', 'brand', 'category')),
  ean text,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  threshold_median_pct numeric NOT NULL DEFAULT 10,
  metric text NOT NULL DEFAULT 'gap_vs_median' CHECK (metric IN ('gap_vs_median', 'gap_vs_best')),
  is_active boolean NOT NULL DEFAULT true,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vpar_vendor ON public.vendor_price_alert_rules(vendor_id) WHERE is_active = true;
CREATE INDEX idx_vpar_ean ON public.vendor_price_alert_rules(vendor_id, ean) WHERE scope = 'ean';
CREATE INDEX idx_vpar_brand ON public.vendor_price_alert_rules(vendor_id, brand_id) WHERE scope = 'brand';

ALTER TABLE public.vendor_price_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vpar_select_own" ON public.vendor_price_alert_rules FOR SELECT
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid()));
CREATE POLICY "vpar_insert_own" ON public.vendor_price_alert_rules FOR INSERT
WITH CHECK (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid()));
CREATE POLICY "vpar_update_own" ON public.vendor_price_alert_rules FOR UPDATE
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid()));
CREATE POLICY "vpar_delete_own" ON public.vendor_price_alert_rules FOR DELETE
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid()));

CREATE TRIGGER trg_vpar_updated_at BEFORE UPDATE ON public.vendor_price_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.vendor_price_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.vendor_price_alert_rules(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  country_code text NOT NULL DEFAULT 'BE',
  metric text NOT NULL,
  threshold_pct numeric NOT NULL,
  observed_pct numeric NOT NULL,
  my_price numeric NOT NULL,
  median_price numeric,
  best_price numeric,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','resolved')),
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vpae_vendor_status ON public.vendor_price_alert_events(vendor_id, status);
CREATE INDEX idx_vpae_created ON public.vendor_price_alert_events(created_at DESC);
CREATE UNIQUE INDEX idx_vpae_open_unique ON public.vendor_price_alert_events(vendor_id, product_id, country_code, metric)
  WHERE status IN ('new','seen');

ALTER TABLE public.vendor_price_alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vpae_select_own" ON public.vendor_price_alert_events FOR SELECT
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid()));
CREATE POLICY "vpae_update_own" ON public.vendor_price_alert_events FOR UPDATE
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid()));

CREATE TRIGGER trg_vpae_updated_at BEFORE UPDATE ON public.vendor_price_alert_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.evaluate_vendor_price_alerts(_vendor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_created int := 0; v_resolved int := 0; v_updated int := 0;
  r RECORD; v_threshold numeric; v_observed numeric;
  v_existing_id uuid; v_metric text;
  v_metrics text[] := ARRAY['gap_vs_median','gap_vs_best'];
  m text;
BEGIN
  FOR r IN
    SELECT mi.*, p.brand_id, p.category_id
    FROM public.get_vendor_market_intelligence(_vendor_id) mi
    JOIN public.products p ON p.id = mi.product_id
  LOOP
    FOREACH m IN ARRAY v_metrics LOOP
      SELECT threshold_median_pct INTO v_threshold
      FROM public.vendor_price_alert_rules
      WHERE vendor_id = _vendor_id AND is_active = true AND metric = m
        AND (
          (scope = 'ean' AND ean = r.gtin)
          OR (scope = 'brand' AND brand_id = r.brand_id)
          OR (scope = 'category' AND category_id = r.category_id)
          OR (scope = 'global')
        )
      ORDER BY CASE scope WHEN 'ean' THEN 1 WHEN 'brand' THEN 2 WHEN 'category' THEN 3 ELSE 4 END
      LIMIT 1;

      IF v_threshold IS NULL THEN CONTINUE; END IF;

      v_observed := CASE WHEN m = 'gap_vs_best' THEN r.gap_vs_best_percentage ELSE r.gap_vs_median_percentage END;

      SELECT id INTO v_existing_id FROM public.vendor_price_alert_events
      WHERE vendor_id = _vendor_id AND product_id = r.product_id
        AND country_code = r.country_code AND metric = m AND status IN ('new','seen')
      LIMIT 1;

      IF v_observed IS NOT NULL AND v_observed >= v_threshold THEN
        IF v_existing_id IS NOT NULL THEN
          UPDATE public.vendor_price_alert_events SET
            observed_pct = v_observed, threshold_pct = v_threshold,
            my_price = r.my_price_excl_vat, median_price = r.medikong_median_price,
            best_price = r.best_medikong_competitor_price, updated_at = now()
          WHERE id = v_existing_id;
          v_updated := v_updated + 1;
        ELSE
          INSERT INTO public.vendor_price_alert_events
            (vendor_id, product_id, country_code, metric, threshold_pct, observed_pct, my_price, median_price, best_price)
          VALUES (_vendor_id, r.product_id, r.country_code, m, v_threshold, v_observed,
                  r.my_price_excl_vat, r.medikong_median_price, r.best_medikong_competitor_price);
          v_created := v_created + 1;
        END IF;
      ELSE
        IF v_existing_id IS NOT NULL THEN
          UPDATE public.vendor_price_alert_events
          SET status = 'resolved', resolved_at = now()
          WHERE id = v_existing_id;
          v_resolved := v_resolved + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('created', v_created, 'updated', v_updated, 'resolved', v_resolved);
END;
$$;