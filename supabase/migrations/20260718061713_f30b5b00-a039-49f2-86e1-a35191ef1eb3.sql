
CREATE OR REPLACE FUNCTION public.admin_commission_timeseries(
  _from date DEFAULT (date_trunc('month', now()) - interval '11 months')::date,
  _to   date DEFAULT (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  _bucket text DEFAULT 'month',   -- 'day' | 'week' | 'month' | 'quarter'
  _type commission_invoice_type DEFAULT NULL,
  _channel commission_sales_channel DEFAULT NULL
)
RETURNS TABLE (
  bucket_start date,
  bucket_label text,
  trading_cents bigint,
  marketplace_cents bigint,
  total_cents bigint,
  cumulative_cents bigint,
  orders_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trunc_unit text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  trunc_unit := CASE lower(_bucket)
                  WHEN 'day' THEN 'day'
                  WHEN 'week' THEN 'week'
                  WHEN 'quarter' THEN 'quarter'
                  ELSE 'month'
                END;

  RETURN QUERY
  WITH src AS (
    SELECT
      date_trunc(trunc_unit, order_created_at)::date AS b,
      type, sales_channel, order_id, commission_excl_vat_cents
    FROM public.admin_commission_backlog_v
    WHERE order_created_at::date BETWEEN _from AND _to
      AND (_type IS NULL OR type = _type)
      AND (_channel IS NULL OR sales_channel = _channel)
    UNION ALL
    SELECT
      date_trunc(trunc_unit, created_at)::date,
      type, sales_channel, order_id, commission_excl_vat_cents
    FROM public.commission_invoices
    WHERE created_at::date BETWEEN _from AND _to
      AND (_type IS NULL OR type = _type)
      AND (_channel IS NULL OR sales_channel = _channel)
  ),
  agg AS (
    SELECT
      b,
      SUM(CASE WHEN type = 'trading' THEN commission_excl_vat_cents ELSE 0 END)::bigint AS trading_cents,
      SUM(CASE WHEN type = 'marketplace' THEN commission_excl_vat_cents ELSE 0 END)::bigint AS marketplace_cents,
      SUM(commission_excl_vat_cents)::bigint AS total_cents,
      COUNT(DISTINCT order_id)::bigint AS orders_count
    FROM src
    GROUP BY b
  )
  SELECT
    a.b AS bucket_start,
    CASE trunc_unit
      WHEN 'day' THEN to_char(a.b, 'DD Mon')
      WHEN 'week' THEN 'S' || to_char(a.b, 'IW') || ' ' || to_char(a.b, 'YY')
      WHEN 'quarter' THEN 'T' || to_char(a.b, 'Q') || ' ' || to_char(a.b, 'YYYY')
      ELSE to_char(a.b, 'Mon YY')
    END AS bucket_label,
    a.trading_cents,
    a.marketplace_cents,
    a.total_cents,
    SUM(a.total_cents) OVER (ORDER BY a.b ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::bigint AS cumulative_cents,
    a.orders_count
  FROM agg a
  ORDER BY a.b;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_commission_timeseries(date, date, text, commission_invoice_type, commission_sales_channel) TO authenticated;
