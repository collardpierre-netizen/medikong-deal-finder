CREATE OR REPLACE FUNCTION public.admin_orders_buyer_type_breakdown(
  _status text DEFAULT 'all',
  _date_from timestamptz DEFAULT NULL,
  _date_to timestamptz DEFAULT NULL,
  _vendor_ids uuid[] DEFAULT NULL,
  _search text DEFAULT NULL,
  _only_with_commission boolean DEFAULT false,
  _forecast_filter text DEFAULT 'all',
  _hide_test boolean DEFAULT true,
  _hide_deleted boolean DEFAULT true,
  _buyer_type text DEFAULT 'all',
  _payment_status text DEFAULT 'all',
  _billing_status text DEFAULT 'all',
  _billing_updated_from timestamptz DEFAULT NULL,
  _billing_updated_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  customer_type text,
  orders bigint,
  gmv_ht numeric,
  gmv_ttc numeric,
  avg_basket numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _q text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _q := NULLIF(btrim(COALESCE(_search, '')), '');

  RETURN QUERY
  WITH base AS (
    SELECT
      COALESCE(c.customer_type::text, 'unknown') AS ctype,
      COALESCE(o.subtotal_excl_vat, 0)::numeric AS ht,
      COALESCE(o.total_incl_vat, 0)::numeric   AS ttc,
      o.payment_status,
      (
        SELECT CASE
          WHEN o.status = 'cancelled' THEN 'cancelled'
          WHEN EXISTS (SELECT 1 FROM public.order_invoices oi WHERE oi.order_id = o.id) THEN
            CASE
              WHEN NOT EXISTS (SELECT 1 FROM public.order_invoices oi WHERE oi.order_id = o.id AND oi.status <> 'paid') THEN 'paid'
              WHEN EXISTS (SELECT 1 FROM public.order_invoices oi WHERE oi.order_id = o.id AND oi.status IN ('overdue','uncollectible')) THEN 'overdue'
              WHEN EXISTS (SELECT 1 FROM public.order_invoices oi WHERE oi.order_id = o.id AND oi.status = 'paid') THEN 'partial'
              ELSE 'invoiced'
            END
          WHEN o.payment_status = 'paid' THEN 'paid'
          WHEN o.status IN ('draft','pending') THEN 'na'
          ELSE 'to_invoice'
        END
      ) AS billing_status,
      (SELECT MAX(oi.updated_at) FROM public.order_invoices oi WHERE oi.order_id = o.id) AS billing_updated_at
    FROM public.orders o
    LEFT JOIN public.customers c ON c.id = o.customer_id
    WHERE
      (_date_from IS NULL OR o.created_at >= _date_from)
      AND (_date_to IS NULL OR o.created_at <= _date_to)
      AND (_status = 'all' OR o.status::text = _status)
      AND (NOT _hide_test OR COALESCE(o.is_test, false) = false)
      AND (NOT _hide_deleted OR COALESCE(o.hidden_from_list, false) = false OR o.status = 'cancelled')
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
        OR EXISTS (SELECT 1 FROM public.order_lines ol WHERE ol.order_id = o.id AND ol.vendor_id = ANY(_vendor_ids))
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
      AND (COALESCE(_buyer_type, 'all') = 'all' OR c.customer_type::text = _buyer_type)
  ),
  filtered AS (
    SELECT * FROM base
    WHERE
      (COALESCE(_payment_status, 'all') = 'all' OR payment_status::text = _payment_status)
      AND (COALESCE(_billing_status, 'all') = 'all' OR billing_status = _billing_status)
      AND (_billing_updated_from IS NULL OR billing_updated_at >= _billing_updated_from)
      AND (_billing_updated_to IS NULL OR billing_updated_at <= _billing_updated_to)
  )
  SELECT
    ctype AS customer_type,
    COUNT(*)::bigint AS orders,
    COALESCE(SUM(ht), 0)::numeric AS gmv_ht,
    COALESCE(SUM(ttc), 0)::numeric AS gmv_ttc,
    CASE WHEN COUNT(*) > 0 THEN (COALESCE(SUM(ht), 0) / COUNT(*))::numeric ELSE 0::numeric END AS avg_basket
  FROM filtered
  GROUP BY ctype
  ORDER BY gmv_ht DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_orders_buyer_type_breakdown(
  text, timestamptz, timestamptz, uuid[], text, boolean, text, boolean, boolean, text, text, text, timestamptz, timestamptz
) TO authenticated, service_role;