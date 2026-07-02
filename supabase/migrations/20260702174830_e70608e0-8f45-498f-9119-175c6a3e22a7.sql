CREATE OR REPLACE FUNCTION public.admin_list_orders(
  _status text DEFAULT 'all'::text,
  _date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _date_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _vendor_ids uuid[] DEFAULT NULL::uuid[],
  _search text DEFAULT NULL::text,
  _only_with_commission boolean DEFAULT false,
  _forecast_filter text DEFAULT 'all'::text,
  _hide_test boolean DEFAULT true,
  _hide_deleted boolean DEFAULT true,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rows jsonb;
  _total bigint;
  _status_counts jsonb;
  _kpis jsonb;
  _q text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _q := NULLIF(btrim(COALESCE(_search, '')), '');

  WITH base AS (
    SELECT o.id, o.status, o.created_at, o.subtotal_excl_vat, o.total_incl_vat,
           COALESCE(o.is_forecast, false) AS is_forecast
    FROM public.orders o
    LEFT JOIN public.customers c ON c.id = o.customer_id
    WHERE
      (_date_from IS NULL OR o.created_at >= _date_from)
      AND (_date_to IS NULL OR o.created_at <= _date_to)
      AND (NOT _hide_test OR COALESCE(o.is_test, false) = false)
      AND (
        NOT _hide_deleted
        OR COALESCE(o.hidden_from_list, false) = false
        OR o.status = 'cancelled'
      )
      AND (
        _forecast_filter = 'all'
        OR (_forecast_filter = 'real' AND COALESCE(o.is_forecast, false) = false)
        OR (_forecast_filter = 'forecast' AND COALESCE(o.is_forecast, false) = true)
      )
      AND (
        _q IS NULL
        OR o.order_number ILIKE '%' || _q || '%'
        OR COALESCE(c.company_name, '') ILIKE '%' || _q || '%'
      )
      AND (
        _vendor_ids IS NULL
        OR array_length(_vendor_ids, 1) IS NULL
        OR EXISTS (
          SELECT 1 FROM public.order_lines ol
          WHERE ol.order_id = o.id AND ol.vendor_id = ANY(_vendor_ids)
        )
      )
      AND (
        NOT _only_with_commission
        OR EXISTS (
          SELECT 1 FROM public.sub_orders so
          WHERE so.order_id = o.id
            AND (
              (so.commission_amount_override IS NOT NULL AND so.commission_amount_override > 0)
              OR (so.commission_rate_override IS NOT NULL AND so.commission_rate_override > 0)
            )
        )
      )
  ),
  filtered AS (
    SELECT b.* FROM base b
    WHERE _status = 'all' OR b.status::text = _status
  ),
  page AS (
    SELECT o.*,
      row_to_json(c.*) AS customer_row,
      COALESCE((
        SELECT jsonb_agg(to_jsonb(ol.*) || jsonb_build_object(
          'vendors', jsonb_build_object(
            'id', v.id,
            'name', v.name,
            'company_name', v.company_name,
            'display_code', v.display_code,
            'slug', v.slug
          )
        ))
        FROM public.order_lines ol
        LEFT JOIN public.vendors v ON v.id = ol.vendor_id
        WHERE ol.order_id = o.id
      ), '[]'::jsonb) AS lines_json,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'vendor_id', so.vendor_id,
          'commission_rate_override', so.commission_rate_override,
          'commission_amount_override', so.commission_amount_override,
          'subtotal_incl_vat', so.subtotal_incl_vat
        ))
        FROM public.sub_orders so
        WHERE so.order_id = o.id
      ), '[]'::jsonb) AS subs_json
    FROM public.orders o
    LEFT JOIN public.customers c ON c.id = o.customer_id
    WHERE o.id IN (SELECT id FROM filtered)
    ORDER BY o.created_at DESC
    LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0)
  ),
  kpi_lines AS (
    SELECT ol.*
    FROM public.order_lines ol
    WHERE ol.order_id IN (SELECT id FROM filtered)
      AND (
        _vendor_ids IS NULL
        OR array_length(_vendor_ids, 1) IS NULL
        OR ol.vendor_id = ANY(_vendor_ids)
      )
  ),
  agg_commission AS (
    SELECT COALESCE(SUM(
      COALESCE(
        kl.commission_amount,
        so.commission_amount_override,
        CASE
          WHEN so.commission_rate_override IS NOT NULL AND kl.line_total_excl_vat IS NOT NULL
            THEN (kl.line_total_excl_vat * so.commission_rate_override) / 100.0
          ELSE 0
        END
      )
    ), 0) AS commission_total
    FROM kpi_lines kl
    LEFT JOIN public.sub_orders so ON so.order_id = kl.order_id AND so.vendor_id = kl.vendor_id
  ),
  agg_margin AS (
    SELECT
      COALESCE(SUM(CASE WHEN COALESCE(kl.line_cost, 0) > 0
                        THEN kl.line_total_excl_vat - kl.line_cost
                        ELSE 0 END), 0) AS margin_total,
      COALESCE(SUM(CASE WHEN COALESCE(kl.line_cost, 0) > 0
                        THEN kl.line_total_excl_vat
                        ELSE 0 END), 0) AS margin_base_ht
    FROM kpi_lines kl
  )
  SELECT
    (SELECT jsonb_agg(to_jsonb(page.*)) FROM page),
    (SELECT count(*) FROM filtered),
    (SELECT jsonb_object_agg(status, cnt) FROM (
      SELECT status::text, count(*) AS cnt FROM filtered GROUP BY status
    ) s),
    jsonb_build_object(
      'gmv_ht', COALESCE((SELECT SUM(line_total_excl_vat) FROM kpi_lines), 0),
      'gmv_ttc', COALESCE((SELECT SUM(line_total_incl_vat) FROM kpi_lines), 0),
      'orders_count', (SELECT count(*) FROM filtered),
      'forecast_count', (SELECT count(*) FROM filtered WHERE is_forecast = true),
      'commission_total', (SELECT commission_total FROM agg_commission),
      'margin_total', (SELECT margin_total FROM agg_margin),
      'margin_base_ht', (SELECT margin_base_ht FROM agg_margin)
    )
  INTO _rows, _total, _status_counts, _kpis;

  RETURN jsonb_build_object(
    'rows', COALESCE(_rows, '[]'::jsonb),
    'total', COALESCE(_total, 0),
    'status_counts', COALESCE(_status_counts, '{}'::jsonb),
    'kpis', COALESCE(_kpis, '{}'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_orders(text, timestamptz, timestamptz, uuid[], text, boolean, text, boolean, boolean, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_orders(text, timestamptz, timestamptz, uuid[], text, boolean, text, boolean, boolean, int, int) TO service_role;

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

  SELECT COALESCE(ROUND(SUM(ol.line_total_excl_vat) * 100), 0)::BIGINT
    INTO v_gmv_cents
  FROM public.order_lines ol
  JOIN public.orders o ON o.id = ol.order_id
  WHERE ol.vendor_id = _vendor_id
    AND COALESCE(o.is_forecast, false) = false
    AND COALESCE(o.is_test, false) = false
    AND COALESCE(o.hidden_from_list, false) = false
    AND o.deleted_at IS NULL
    AND o.status::text NOT IN ('cancelled','canceled','refused','rejected','refunded','failed')
    AND o.created_at >= v_window_start
    AND o.created_at < v_window_end;

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