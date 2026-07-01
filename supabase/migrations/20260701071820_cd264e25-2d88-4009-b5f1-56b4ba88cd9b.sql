
CREATE OR REPLACE FUNCTION public.admin_list_orders(
  _status text DEFAULT 'all',
  _date_from timestamptz DEFAULT NULL,
  _date_to timestamptz DEFAULT NULL,
  _vendor_ids uuid[] DEFAULT NULL,
  _search text DEFAULT NULL,
  _only_with_commission boolean DEFAULT false,
  _forecast_filter text DEFAULT 'all', -- 'all' | 'real' | 'forecast'
  _hide_test boolean DEFAULT true,
  _hide_deleted boolean DEFAULT true,
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rows jsonb;
  _total bigint;
  _status_counts jsonb;
  _kpis jsonb;
  _q text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _q := NULLIF(btrim(COALESCE(_search, '')), '');

  -- Filtered id set (matches all criteria EXCEPT status, used for status counts)
  WITH base AS (
    SELECT o.id, o.status, o.created_at
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
          WHERE ol.order_id = o.id
            AND ol.vendor_id = ANY(_vendor_ids)
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
        SELECT jsonb_agg(row_to_json(ol.*))
        FROM public.order_lines ol
        WHERE ol.order_id = o.id
      ), '[]'::jsonb) AS lines_json,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
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
  )
  SELECT
    jsonb_agg(to_jsonb(page.*)),
    (SELECT count(*) FROM filtered),
    (
      SELECT jsonb_object_agg(status_key, cnt) FROM (
        SELECT 'all' AS status_key, (SELECT count(*) FROM base) AS cnt
        UNION ALL
        SELECT b.status::text, count(*) FROM base b GROUP BY b.status
      ) s
    ),
    (
      SELECT jsonb_build_object(
        'total_ht', COALESCE(sum(o.subtotal_excl_vat), 0),
        'total_incl_vat', COALESCE(sum(o.total_incl_vat), 0),
        'orders_count', count(*)
      )
      FROM public.orders o WHERE o.id IN (SELECT id FROM filtered)
    )
  INTO _rows, _total, _status_counts, _kpis
  FROM page;

  RETURN jsonb_build_object(
    'rows', COALESCE(_rows, '[]'::jsonb),
    'total', COALESCE(_total, 0),
    'status_counts', COALESCE(_status_counts, '{}'::jsonb),
    'kpis', COALESCE(_kpis, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_orders(text, timestamptz, timestamptz, uuid[], text, boolean, text, boolean, boolean, int, int) TO authenticated;
