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
  agg_line_commission AS (
    SELECT COALESCE(SUM(kl.commission_amount), 0) AS line_commission_total
    FROM kpi_lines kl
    WHERE kl.commission_amount IS NOT NULL
  ),
  agg_sub_commission AS (
    SELECT COALESCE(SUM(
      COALESCE(
        so.commission_amount_override,
        CASE
          WHEN so.commission_rate_override IS NOT NULL AND so.subtotal_incl_vat IS NOT NULL
            THEN (so.subtotal_incl_vat * so.commission_rate_override) / 100.0
          ELSE 0
        END
      )
    ), 0) AS sub_commission_total
    FROM public.sub_orders so
    WHERE so.order_id IN (SELECT id FROM filtered)
      AND (
        _vendor_ids IS NULL
        OR array_length(_vendor_ids, 1) IS NULL
        OR so.vendor_id = ANY(_vendor_ids)
      )
      AND NOT EXISTS (
        SELECT 1 FROM kpi_lines kl
        WHERE kl.order_id = so.order_id
          AND kl.vendor_id = so.vendor_id
          AND kl.commission_amount IS NOT NULL
      )
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
    -- Compteurs par statut agrégés sur `base` (avant filtre _status)
    -- pour que chaque onglet reflète le vrai total, indépendamment de
    -- l'onglet sélectionné.
    (SELECT jsonb_object_agg(status, cnt) FROM (
      SELECT status::text, count(*) AS cnt FROM base GROUP BY status
    ) s),
    jsonb_build_object(
      'gmv_ht', COALESCE((SELECT SUM(line_total_excl_vat) FROM kpi_lines), 0),
      'gmv_ttc', COALESCE((SELECT SUM(line_total_incl_vat) FROM kpi_lines), 0),
      'orders_count', (SELECT count(*) FROM filtered),
      'forecast_count', (SELECT count(*) FROM filtered WHERE is_forecast = true),
      'commission_total', (SELECT line_commission_total FROM agg_line_commission) + (SELECT sub_commission_total FROM agg_sub_commission),
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