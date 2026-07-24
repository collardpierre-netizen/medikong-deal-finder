-- Add 'mixed' value to commission_invoice_type enum to support consolidated invoices
-- that regroup both marketplace and trading lines in a single invoice per vendor.
ALTER TYPE public.commission_invoice_type ADD VALUE IF NOT EXISTS 'mixed';

-- Migration continues in a separate statement because ALTER TYPE ... ADD VALUE
-- cannot be used in the same transaction as the new value on some Postgres versions.
-- We defer the function creation to a follow-up migration if needed. Postgres 14+ allows same-tx usage.

-- RPC: create ONE consolidated commission invoice per vendor regrouping many order lines
-- across multiple orders, for a given period. Lines keep their individual type
-- (marketplace/trading) in commission_invoice_lines to preserve the detail.
CREATE OR REPLACE FUNCTION public.admin_create_consolidated_commission_invoice(
  _vendor_id uuid,
  _order_line_ids uuid[],
  _period_start date,
  _period_end date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  v_country text;
  v_vat_rate numeric;
  v_channel public.commission_sales_channel;
  v_gmv bigint;
  v_rev bigint;
  v_com bigint;
  v_lines int;
  v_orders int;
  v_vat bigint;
  v_type public.commission_invoice_type;
  v_has_marketplace boolean;
  v_has_trading boolean;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _order_line_ids IS NULL OR array_length(_order_line_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no_lines';
  END IF;

  SELECT country_code INTO v_country FROM public.vendors WHERE id = _vendor_id;
  v_vat_rate := public.resolve_commission_vat_rate(v_country);

  -- Aggregate (multi-order) — only valid backlog rows for this vendor
  SELECT
    COALESCE(SUM(b.gmv_incl_vat_cents), 0),
    COALESCE(SUM(b.revenue_excl_vat_cents), 0),
    COALESCE(SUM(b.commission_excl_vat_cents), 0),
    COUNT(*),
    COUNT(DISTINCT b.order_id),
    BOOL_OR(b.type = 'marketplace'),
    BOOL_OR(b.type = 'trading')
  INTO v_gmv, v_rev, v_com, v_lines, v_orders, v_has_marketplace, v_has_trading
  FROM public.admin_commission_backlog_v b
  WHERE b.order_line_id = ANY(_order_line_ids)
    AND b.vendor_id = _vendor_id;

  IF v_lines = 0 THEN
    RAISE EXCEPTION 'no_valid_lines';
  END IF;

  -- Choose the invoice-level type
  IF v_has_marketplace AND v_has_trading THEN
    v_type := 'mixed';
  ELSIF v_has_trading THEN
    v_type := 'trading';
  ELSE
    v_type := 'marketplace';
  END IF;

  -- Sales channel: 'manual' iff all rows are manual, else 'online'
  SELECT CASE
    WHEN BOOL_AND(b.sales_channel = 'manual') THEN 'manual'::public.commission_sales_channel
    ELSE 'online'::public.commission_sales_channel
  END
  INTO v_channel
  FROM public.admin_commission_backlog_v b
  WHERE b.order_line_id = ANY(_order_line_ids)
    AND b.vendor_id = _vendor_id;

  v_vat := ROUND(v_com * v_vat_rate / 100.0);

  INSERT INTO public.commission_invoices (
    invoice_number, vendor_id, order_id, type, sales_channel, status,
    period_start, period_end,
    orders_count, lines_count,
    gmv_incl_vat_cents, revenue_excl_vat_cents, commission_excl_vat_cents,
    vat_rate, vat_cents, total_incl_vat_cents, vendor_country_code,
    notes, created_by
  ) VALUES (
    public.next_commission_invoice_number(),
    _vendor_id, NULL, v_type, v_channel, 'to_invoice',
    _period_start, _period_end,
    v_orders, v_lines,
    v_gmv, v_rev, v_com,
    v_vat_rate, v_vat, v_com + v_vat, v_country,
    'Facturation consolidée — ' || v_orders || ' commande(s), ' || v_lines || ' ligne(s) — période '
      || to_char(_period_start, 'YYYY-MM-DD') || ' → ' || to_char(_period_end, 'YYYY-MM-DD'),
    auth.uid()
  )
  RETURNING id INTO new_id;

  -- Insert invoice lines (keep individual type per line)
  INSERT INTO public.commission_invoice_lines (
    commission_invoice_id, order_line_id, order_id, type,
    gmv_incl_vat_cents, revenue_excl_vat_cents, commission_excl_vat_cents,
    commission_basis, commission_rate
  )
  SELECT
    new_id, b.order_line_id, b.order_id, b.type,
    b.gmv_incl_vat_cents, b.revenue_excl_vat_cents, b.commission_excl_vat_cents,
    b.commission_basis, b.commission_rate
  FROM public.admin_commission_backlog_v b
  WHERE b.order_line_id = ANY(_order_line_ids)
    AND b.vendor_id = _vendor_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_consolidated_commission_invoice(uuid, uuid[], date, date) TO authenticated;