CREATE OR REPLACE FUNCTION public.admin_list_orders(_status text DEFAULT 'all'::text, _date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, _date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, _vendor_ids uuid[] DEFAULT NULL::uuid[], _search text DEFAULT NULL::text, _only_with_commission boolean DEFAULT false, _forecast_filter text DEFAULT 'all'::text, _hide_test boolean DEFAULT true, _hide_deleted boolean DEFAULT true, _limit integer DEFAULT 50, _offset integer DEFAULT 0, _buyer_type text DEFAULT 'all'::text, _payment_status text DEFAULT 'all'::text, _billing_status text DEFAULT 'all'::text, _sort_by text DEFAULT 'date'::text, _sort_dir text DEFAULT 'desc'::text, _billing_updated_from timestamp with time zone DEFAULT NULL::timestamp with time zone, _billing_updated_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
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
  _sb text;
  _sd text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _q := NULLIF(btrim(COALESCE(_search, '')), '');
  _sb := lower(COALESCE(NULLIF(_sort_by, ''), 'date'));
  _sd := lower(COALESCE(NULLIF(_sort_dir, ''), 'desc'));
  IF _sb NOT IN ('date','total','payment','billing') THEN _sb := 'date'; END IF;
  IF _sd NOT IN ('asc','desc') THEN _sd := 'desc'; END IF;

  WITH base AS (
    SELECT o.id, o.status, o.created_at, o.subtotal_excl_vat, o.total_incl_vat,
           COALESCE(o.is_forecast, false) AS is_forecast,
           o.payment_status,
           c.customer_type,
           (SELECT MAX(oi.updated_at) FROM public.order_invoices oi WHERE oi.order_id = o.id) AS billing_updated_at,
           (
             SELECT CASE
               WHEN o.status = 'cancelled' THEN 'cancelled'
               WHEN EXISTS (SELECT 1 FROM public.order_invoices oi WHERE oi.order_id = o.id) THEN
                 CASE
                   WHEN NOT EXISTS (
                     SELECT 1 FROM public.order_invoices oi WHERE oi.order_id = o.id AND oi.status <> 'paid'
                   ) THEN 'paid'
                   WHEN EXISTS (
                     SELECT 1 FROM public.order_invoices oi WHERE oi.order_id = o.id
                       AND oi.status IN ('overdue','uncollectible')
                   ) THEN 'overdue'
                   WHEN EXISTS (
                     SELECT 1 FROM public.order_invoices oi WHERE oi.order_id = o.id AND oi.status = 'paid'
                   ) THEN 'partial'
                   ELSE 'invoiced'
                 END
               WHEN o.payment_status = 'paid' THEN 'paid'
               WHEN o.status IN ('draft','pending') THEN 'na'
               ELSE 'to_invoice'
             END
           ) AS billing_status
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
        OR COALESCE(c.email, '') ILIKE '%' || _q || '%'
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
      AND (
        COALESCE(_buyer_type, 'all') = 'all'
        OR c.customer_type::text = _buyer_type
      )
      AND (
        COALESCE(_payment_status, 'all') = 'all'
        OR COALESCE(o.payment_status::text, 'pending') = _payment_status
      )
  ),
  filtered AS (
    SELECT b.* FROM base b
    WHERE (_status = 'all' OR b.status::text = _status)
      AND (COALESCE(_billing_status, 'all') = 'all' OR b.billing_status = _billing_status)
      AND (_billing_updated_from IS NULL OR b.billing_updated_at >= _billing_updated_from)
      AND (_billing_updated_to IS NULL OR b.billing_updated_at <= _billing_updated_to)
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
          ),
          'products', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'slug', p.slug,
            'image_url', p.image_url
          ) END
        ))
        FROM public.order_lines ol
        LEFT JOIN public.vendors v ON v.id = ol.vendor_id
        LEFT JOIN public.products p ON p.id = ol.product_id
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
    JOIN filtered f ON f.id = o.id
    ORDER BY
      CASE WHEN _sb = 'date'    AND _sd = 'asc'  THEN o.created_at END ASC NULLS LAST,
      CASE WHEN _sb = 'date'    AND _sd = 'desc' THEN o.created_at END DESC NULLS LAST,
      CASE WHEN _sb = 'total'   AND _sd = 'asc'  THEN o.total_incl_vat END ASC NULLS LAST,
      CASE WHEN _sb = 'total'   AND _sd = 'desc' THEN o.total_incl_vat END DESC NULLS LAST,
      CASE WHEN _sb = 'payment' AND _sd = 'asc'  THEN COALESCE(o.payment_status::text, '') END ASC,
      CASE WHEN _sb = 'payment' AND _sd = 'desc' THEN COALESCE(o.payment_status::text, '') END DESC,
      CASE WHEN _sb = 'billing' AND _sd = 'asc'  THEN f.billing_status END ASC,
      CASE WHEN _sb = 'billing' AND _sd = 'desc' THEN f.billing_status END DESC,
      o.created_at DESC
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
          THEN so.subtotal_incl_vat * so.commission_rate_override / 100
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
  ),
  agg_margin AS (
    SELECT
      COALESCE(SUM(
        CASE
          WHEN kl.line_cost IS NOT NULL AND kl.line_cost > 0 THEN kl.line_cost
          WHEN kl.cost_price IS NOT NULL AND kl.cost_price > 0 THEN kl.cost_price * kl.quantity
          ELSE 0
        END
      ), 0) AS cost_total,
      COALESCE(SUM(
        CASE
          WHEN (kl.line_cost IS NOT NULL AND kl.line_cost > 0)
            OR (kl.cost_price IS NOT NULL AND kl.cost_price > 0)
          THEN COALESCE(kl.line_total_excl_vat, 0)
          ELSE 0
        END
      ), 0) AS ca_ht_with_cost
    FROM kpi_lines kl
  ),
  agg_orders AS (
    SELECT
      COUNT(*) AS orders_count,
      COALESCE(SUM(subtotal_excl_vat), 0) AS gmv_ht,
      COALESCE(SUM(total_incl_vat), 0) AS gmv_ttc,
      COUNT(*) FILTER (WHERE is_forecast) AS forecast_count
    FROM filtered
  )
  SELECT
    (SELECT COUNT(*) FROM filtered),
    (SELECT jsonb_agg(row_to_json(page.*)) FROM page),
    (SELECT jsonb_object_agg(status, cnt) FROM (
      SELECT status::text, COUNT(*) AS cnt FROM base GROUP BY status
    ) s),
    jsonb_build_object(
      'orders_count', (SELECT orders_count FROM agg_orders),
      'gmv_ht', (SELECT gmv_ht FROM agg_orders),
      'gmv_ttc', (SELECT gmv_ttc FROM agg_orders),
      'forecast_count', (SELECT forecast_count FROM agg_orders),
      'commission_total', GREATEST(
        (SELECT line_commission_total FROM agg_line_commission),
        (SELECT sub_commission_total FROM agg_sub_commission)
      ),
      'margin_total', (SELECT ca_ht_with_cost - cost_total FROM agg_margin),
      'margin_base_ht', (SELECT ca_ht_with_cost FROM agg_margin)
    )
  INTO _total, _rows, _status_counts, _kpis;

  RETURN jsonb_build_object(
    'total', COALESCE(_total, 0),
    'rows', COALESCE(_rows, '[]'::jsonb),
    'status_counts', COALESCE(_status_counts, '{}'::jsonb),
    'kpis', COALESCE(_kpis, '{}'::jsonb)
  );
END;
$function$;