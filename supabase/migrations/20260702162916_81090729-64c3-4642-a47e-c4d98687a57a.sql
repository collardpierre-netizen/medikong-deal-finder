
CREATE TABLE public.margin_rule_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  margin_rule_id UUID NOT NULL REFERENCES public.margin_rules(id) ON DELETE CASCADE,
  min_gmv_cents BIGINT NOT NULL CHECK (min_gmv_cents >= 0),
  margin_percentage NUMERIC NOT NULL CHECK (margin_percentage >= 0 AND margin_percentage <= 100),
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_margin_rule_tiers_rule ON public.margin_rule_tiers(margin_rule_id, min_gmv_cents);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.margin_rule_tiers TO authenticated;
GRANT ALL ON public.margin_rule_tiers TO service_role;

ALTER TABLE public.margin_rule_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all margin rule tiers"
  ON public.margin_rule_tiers FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Vendors can view their own margin rule tiers"
  ON public.margin_rule_tiers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.margin_rules mr
      JOIN public.vendors v ON v.id = mr.vendor_id
      WHERE mr.id = margin_rule_tiers.margin_rule_id
        AND v.auth_user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_margin_rule_tiers_updated_at
  BEFORE UPDATE ON public.margin_rule_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.margin_rules
  ADD COLUMN IF NOT EXISTS gmv_window TEXT NOT NULL DEFAULT 'calendar_year'
    CHECK (gmv_window IN ('calendar_year', 'rolling_12m')),
  ADD COLUMN IF NOT EXISTS tiers_direction TEXT NOT NULL DEFAULT 'decreasing'
    CHECK (tiers_direction IN ('decreasing', 'increasing'));

CREATE OR REPLACE FUNCTION public.get_vendor_gmv_progress(_vendor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_auth_owns BOOLEAN;
  v_rule RECORD;
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_gmv_cents BIGINT := 0;
  v_current_pct NUMERIC;
  v_current_label TEXT := NULL;
  v_next_min BIGINT := NULL;
  v_next_pct NUMERIC := NULL;
  v_next_label TEXT := NULL;
  v_progress NUMERIC := 0;
  v_tier_count INTEGER := 0;
  v_prev_min BIGINT;
BEGIN
  SELECT public.is_admin(auth.uid()) INTO v_is_admin;
  SELECT EXISTS (
    SELECT 1 FROM public.vendors WHERE id = _vendor_id AND auth_user_id = auth.uid()
  ) INTO v_auth_owns;

  IF NOT COALESCE(v_is_admin, false) AND NOT v_auth_owns THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_rule
  FROM public.margin_rules
  WHERE vendor_id = _vendor_id AND is_active = true
  ORDER BY priority DESC, created_at DESC
  LIMIT 1;

  IF v_rule IS NULL THEN
    SELECT * INTO v_rule
    FROM public.margin_rules
    WHERE vendor_id IS NULL AND is_active = true
      AND category_id IS NULL AND brand_id IS NULL
      AND min_base_price IS NULL AND max_base_price IS NULL
    ORDER BY priority DESC, created_at DESC
    LIMIT 1;
  END IF;

  IF v_rule IS NULL OR v_rule.gmv_window = 'calendar_year' THEN
    v_window_start := date_trunc('year', now());
    v_window_end := v_window_start + interval '1 year';
  ELSE
    v_window_start := now() - interval '12 months';
    v_window_end := now();
  END IF;

  SELECT COALESCE(SUM(ol.line_total_excl_vat), 0)::BIGINT
    INTO v_gmv_cents
  FROM public.order_lines ol
  WHERE ol.vendor_id = _vendor_id
    AND ol.is_forecast = false
    AND ol.status NOT IN ('cancelled','refused','refunded')
    AND ol.created_at >= v_window_start
    AND ol.created_at < v_window_end;

  v_current_pct := COALESCE(v_rule.margin_percentage, 20);

  IF v_rule IS NOT NULL THEN
    SELECT COUNT(*) INTO v_tier_count
    FROM public.margin_rule_tiers WHERE margin_rule_id = v_rule.id;
  END IF;

  IF v_rule IS NOT NULL AND v_tier_count > 0 THEN
    SELECT t.margin_percentage, t.label
      INTO v_current_pct, v_current_label
    FROM public.margin_rule_tiers t
    WHERE t.margin_rule_id = v_rule.id
      AND t.min_gmv_cents <= v_gmv_cents
    ORDER BY t.min_gmv_cents DESC
    LIMIT 1;

    IF v_current_pct IS NULL THEN
      v_current_pct := v_rule.margin_percentage;
    END IF;

    SELECT t.min_gmv_cents, t.margin_percentage, t.label
      INTO v_next_min, v_next_pct, v_next_label
    FROM public.margin_rule_tiers t
    WHERE t.margin_rule_id = v_rule.id
      AND t.min_gmv_cents > v_gmv_cents
    ORDER BY t.min_gmv_cents ASC
    LIMIT 1;

    IF v_next_min IS NOT NULL THEN
      SELECT COALESCE(MAX(t.min_gmv_cents), 0)
        INTO v_prev_min
      FROM public.margin_rule_tiers t
      WHERE t.margin_rule_id = v_rule.id
        AND t.min_gmv_cents <= v_gmv_cents;

      IF v_next_min > v_prev_min THEN
        v_progress := LEAST(100, GREATEST(0,
          ((v_gmv_cents - v_prev_min)::NUMERIC / (v_next_min - v_prev_min)::NUMERIC) * 100
        ));
      END IF;
    ELSE
      v_progress := 100;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'vendor_id', _vendor_id,
    'rule_id', v_rule.id,
    'rule_name', v_rule.name,
    'gmv_window', COALESCE(v_rule.gmv_window, 'calendar_year'),
    'tiers_direction', COALESCE(v_rule.tiers_direction, 'decreasing'),
    'window_start', v_window_start,
    'window_end', v_window_end,
    'current_gmv_cents', v_gmv_cents,
    'current_tier_percentage', v_current_pct,
    'current_tier_label', v_current_label,
    'base_percentage', v_rule.margin_percentage,
    'next_tier_min_gmv_cents', v_next_min,
    'next_tier_percentage', v_next_pct,
    'next_tier_label', v_next_label,
    'progress_pct', v_progress,
    'has_tiers', (v_tier_count > 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_gmv_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_gmv_progress(UUID) TO service_role;
