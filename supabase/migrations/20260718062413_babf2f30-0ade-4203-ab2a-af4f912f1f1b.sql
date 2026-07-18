CREATE OR REPLACE VIEW public.admin_commission_backlog_v
WITH (security_invoker = true)
AS
WITH line_source AS (
  SELECT
    ol.id AS order_line_id,
    ol.order_id,
    o.order_number,
    o.created_at AS order_created_at,
    o.status AS order_status,
    o.payment_status,
    o.source AS order_source,
    CASE
      WHEN o.source = 'manual_admin' OR o.created_by_admin IS NOT NULL THEN 'manual'::public.commission_sales_channel
      ELSE 'online'::public.commission_sales_channel
    END AS sales_channel,
    ol.vendor_id,
    COALESCE(v.company_name, v.name) AS vendor_display_name,
    v.country_code AS vendor_country_code,
    ol.quantity,
    ol.commission_basis AS line_commission_basis,
    ol.commission_rate AS line_commission_rate,
    ol.commission_amount AS line_commission_amount,
    ol.line_total_incl_vat,
    ol.line_total_excl_vat,
    so.commission_rate_override,
    so.commission_amount_override,
    SUM(COALESCE(ol.line_total_excl_vat, 0)) OVER (PARTITION BY ol.order_id, ol.vendor_id) AS vendor_revenue_excl_vat,
    ROW_NUMBER() OVER (PARTITION BY ol.order_id, ol.vendor_id ORDER BY ol.id) AS vendor_line_rank
  FROM public.order_lines ol
  JOIN public.orders o ON o.id = ol.order_id
  LEFT JOIN public.vendors v ON v.id = ol.vendor_id
  LEFT JOIN public.sub_orders so ON so.order_id = ol.order_id AND so.vendor_id = ol.vendor_id
  WHERE o.is_forecast = false
    AND o.is_test = false
    AND o.hidden_from_list = false
    AND o.deleted_at IS NULL
    AND lower(o.status::text) NOT IN ('cancelled','canceled','refused','rejected','refunded','failed')
    AND NOT EXISTS (
      SELECT 1 FROM public.commission_invoice_lines cil
      WHERE cil.order_line_id = ol.id
    )
), calculated AS (
  SELECT
    ls.*,
    ROUND(COALESCE(ls.line_commission_amount, 0) * 100)::bigint AS line_commission_cents,
    ROUND(COALESCE(ls.commission_amount_override, 0) * 100)::bigint AS override_commission_cents,
    CASE
      WHEN COALESCE(ls.commission_amount_override, 0) > 0 AND COALESCE(ls.vendor_revenue_excl_vat, 0) > 0
      THEN ROUND(
        ROUND(COALESCE(ls.commission_amount_override, 0) * 100)::bigint
        * COALESCE(ls.line_total_excl_vat, 0)
        / NULLIF(ls.vendor_revenue_excl_vat, 0)
      )::bigint
      ELSE 0::bigint
    END AS allocated_override_cents
  FROM line_source ls
), effective AS (
  SELECT
    c.*,
    (
      CASE
        WHEN c.line_commission_cents > 0 THEN c.line_commission_cents::numeric
        WHEN c.override_commission_cents > 0 AND COALESCE(c.vendor_revenue_excl_vat, 0) > 0 THEN
          CASE
            WHEN c.vendor_line_rank = 1 THEN
              c.override_commission_cents::numeric
              - COALESCE(
                  SUM(c.allocated_override_cents) FILTER (WHERE c.vendor_line_rank <> 1)
                    OVER (PARTITION BY c.order_id, c.vendor_id),
                  0
                )
            ELSE c.allocated_override_cents::numeric
          END
        WHEN COALESCE(c.commission_rate_override, 0) > 0 THEN
          ROUND(COALESCE(c.line_total_excl_vat, 0) * c.commission_rate_override)::numeric
        ELSE 0::numeric
      END
    )::bigint AS effective_commission_cents
  FROM calculated c
)
SELECT
  e.order_line_id,
  e.order_id,
  e.order_number,
  e.order_created_at,
  e.order_status,
  e.payment_status,
  e.order_source,
  e.sales_channel,
  e.vendor_id,
  e.vendor_display_name,
  e.vendor_country_code,
  e.quantity,
  COALESCE(e.line_commission_basis, 'ca') AS commission_basis,
  CASE
    WHEN COALESCE(e.line_commission_basis, 'ca') = 'margin' THEN 'trading'::public.commission_invoice_type
    ELSE 'marketplace'::public.commission_invoice_type
  END AS type,
  COALESCE(
    e.line_commission_rate,
    e.commission_rate_override,
    CASE
      WHEN COALESCE(e.commission_amount_override, 0) > 0 AND COALESCE(e.vendor_revenue_excl_vat, 0) > 0
      THEN e.commission_amount_override * 100 / NULLIF(e.vendor_revenue_excl_vat, 0)
      ELSE NULL
    END
  ) AS commission_rate,
  ROUND(COALESCE(e.line_total_incl_vat, 0) * 100)::bigint AS gmv_incl_vat_cents,
  ROUND(COALESCE(e.line_total_excl_vat, 0) * 100)::bigint AS revenue_excl_vat_cents,
  e.effective_commission_cents::bigint AS commission_excl_vat_cents,
  to_char(date_trunc('month', e.order_created_at), 'YYYY-MM') AS period_month,
  EXTRACT(EPOCH FROM (now() - e.order_created_at)) / 86400 AS age_days
FROM effective e
WHERE e.effective_commission_cents > 0;

GRANT SELECT ON public.admin_commission_backlog_v TO authenticated;