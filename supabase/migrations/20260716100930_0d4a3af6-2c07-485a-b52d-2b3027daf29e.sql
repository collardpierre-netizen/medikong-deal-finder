
CREATE OR REPLACE FUNCTION public.get_vendor_gmv_progress(_vendor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF v_rule.id IS NULL THEN
    SELECT * INTO v_rule
    FROM public.margin_rules
    WHERE vendor_id IS NULL AND is_active = true
      AND category_id IS NULL AND brand_id IS NULL
      AND min_base_price IS NULL AND max_base_price IS NULL
    ORDER BY priority DESC, created_at DESC
    LIMIT 1;
  END IF;

  IF v_rule.id IS NULL OR v_rule.gmv_window = 'calendar_year' THEN
    v_window_start := date_trunc('year', now());
    v_window_end := v_window_start + interval '1 year';
  ELSE
    v_window_start := now() - interval '12 months';
    v_window_end := now();
  END IF;

  -- IMPORTANT : le palier négocié s'applique uniquement à la part "marketplace"
  -- (commission_basis = 'ca' ou NULL, valeur par défaut). Les lignes "trading"
  -- (commission_basis = 'margin', 100% de la marge PV−PA) sont explicitement
  -- exclues afin qu'elles n'influent pas sur le franchissement du palier.
  SELECT COALESCE(ROUND(SUM(ol.line_total_excl_vat) * 100), 0)::BIGINT
    INTO v_gmv_cents
  FROM public.order_lines ol
  JOIN public.orders o ON o.id = ol.order_id
  WHERE ol.vendor_id = _vendor_id
    AND COALESCE(ol.commission_basis, 'ca') <> 'margin'
    AND COALESCE(o.is_forecast, false) = false
    AND COALESCE(o.is_test, false) = false
    AND COALESCE(o.hidden_from_list, false) = false
    AND o.deleted_at IS NULL
    AND o.status::text NOT IN ('cancelled','canceled','refused','rejected','refunded','failed')
    AND o.created_at >= v_window_start
    AND o.created_at < v_window_end;

  v_current_pct := COALESCE(v_rule.margin_percentage, 20);

  IF v_rule.id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_tier_count
    FROM public.margin_rule_tiers WHERE margin_rule_id = v_rule.id;
  END IF;

  IF v_rule.id IS NOT NULL AND v_tier_count > 0 THEN
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
    'gmv_scope', 'marketplace_only',
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
$function$;
