CREATE OR REPLACE FUNCTION public.admin_commission_by_vendor(_period_start date DEFAULT (date_trunc('month'::text, now()))::date, _period_end date DEFAULT ((date_trunc('month'::text, now()) + '1 mon -1 days'::interval))::date, _type commission_invoice_type DEFAULT NULL::commission_invoice_type, _channel commission_sales_channel DEFAULT NULL::commission_sales_channel)
 RETURNS TABLE(vendor_id uuid, vendor_display_name text, vendor_country_code text, orders_count bigint, lines_count bigint, gmv_incl_vat_cents bigint, revenue_excl_vat_cents bigint, commission_trading_cents bigint, commission_marketplace_cents bigint, commission_total_cents bigint, to_invoice_cents bigint, invoiced_cents bigint, paid_cents bigint, disputed_cents bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH backlog AS (
    SELECT b.vendor_id, b.vendor_display_name, b.vendor_country_code,
      b.order_id, b.type, b.sales_channel,
      b.gmv_incl_vat_cents, b.revenue_excl_vat_cents, b.commission_excl_vat_cents
    FROM public.admin_commission_backlog_v b
    WHERE b.order_created_at::date BETWEEN _period_start AND _period_end
      AND (_type IS NULL OR b.type = _type)
      AND (_channel IS NULL OR b.sales_channel = _channel)
  ),
  invoiced AS (
    SELECT ci.vendor_id, ci.status, ci.type, ci.sales_channel, ci.commission_excl_vat_cents
    FROM public.commission_invoices ci
    WHERE ci.created_at::date BETWEEN _period_start AND _period_end
      AND (_type IS NULL OR ci.type = _type)
      AND (_channel IS NULL OR ci.sales_channel = _channel)
  ),
  agg AS (
    SELECT b.vendor_id, b.vendor_display_name, b.vendor_country_code,
      COUNT(DISTINCT b.order_id) AS orders_count,
      COUNT(*) AS lines_count,
      SUM(b.gmv_incl_vat_cents) AS gmv_incl_vat_cents,
      SUM(b.revenue_excl_vat_cents) AS revenue_excl_vat_cents,
      SUM(CASE WHEN b.type = 'trading' THEN b.commission_excl_vat_cents ELSE 0 END) AS commission_trading_cents,
      SUM(CASE WHEN b.type = 'marketplace' THEN b.commission_excl_vat_cents ELSE 0 END) AS commission_marketplace_cents,
      SUM(b.commission_excl_vat_cents) AS commission_total_cents,
      SUM(b.commission_excl_vat_cents) AS to_invoice_cents
    FROM backlog b
    GROUP BY b.vendor_id, b.vendor_display_name, b.vendor_country_code
  ),
  inv_agg AS (
    SELECT iv.vendor_id,
      SUM(CASE WHEN iv.status = 'invoiced' THEN iv.commission_excl_vat_cents ELSE 0 END) AS invoiced_cents,
      SUM(CASE WHEN iv.status = 'paid' THEN iv.commission_excl_vat_cents ELSE 0 END) AS paid_cents,
      SUM(CASE WHEN iv.status = 'disputed' THEN iv.commission_excl_vat_cents ELSE 0 END) AS disputed_cents
    FROM invoiced iv GROUP BY iv.vendor_id
  )
  SELECT
    COALESCE(a.vendor_id, i.vendor_id),
    a.vendor_display_name,
    a.vendor_country_code,
    COALESCE(a.orders_count, 0),
    COALESCE(a.lines_count, 0),
    COALESCE(a.gmv_incl_vat_cents, 0),
    COALESCE(a.revenue_excl_vat_cents, 0),
    COALESCE(a.commission_trading_cents, 0),
    COALESCE(a.commission_marketplace_cents, 0),
    COALESCE(a.commission_total_cents, 0),
    COALESCE(a.to_invoice_cents, 0),
    COALESCE(i.invoiced_cents, 0),
    COALESCE(i.paid_cents, 0),
    COALESCE(i.disputed_cents, 0)
  FROM agg a
  FULL OUTER JOIN inv_agg i ON i.vendor_id = a.vendor_id
  ORDER BY COALESCE(a.commission_total_cents, 0) + COALESCE(i.invoiced_cents, 0) + COALESCE(i.paid_cents, 0) DESC;
END $function$;