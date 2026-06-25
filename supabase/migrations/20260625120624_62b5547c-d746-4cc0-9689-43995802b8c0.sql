CREATE OR REPLACE FUNCTION public.admin_load_order_for_edit(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_lines jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF v_order.draft_payload IS NOT NULL AND jsonb_array_length(COALESCE(v_order.draft_payload->'lines','[]'::jsonb)) > 0 THEN
    RETURN v_order.draft_payload || jsonb_build_object(
      'fulfillment_mode', v_order.fulfillment_mode,
      'shipping_address_id', v_order.shipping_address_id,
      'shipping_address', v_order.shipping_address
    );
  END IF;

  WITH vendor_totals AS (
    SELECT
      ol.vendor_id,
      SUM(ol.line_total_excl_vat) AS vendor_subtotal_excl_vat,
      MAX(so.commission_rate_override) FILTER (WHERE so.commission_rate_override IS NOT NULL) AS commission_rate_override,
      MAX(so.commission_amount_override) FILTER (WHERE so.commission_amount_override IS NOT NULL) AS commission_amount_override
    FROM public.order_lines ol
    LEFT JOIN public.sub_orders so
      ON so.order_id = ol.order_id
     AND so.vendor_id = ol.vendor_id
    WHERE ol.order_id = _order_id
    GROUP BY ol.vendor_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'mode', CASE WHEN l.offer_id IS NOT NULL OR COALESCE(l.product_id, off.product_id) IS NOT NULL THEN 'offer' ELSE 'free' END,
    'vendor_id', l.vendor_id,
    'offer_id', l.offer_id,
    'product_id', COALESCE(l.product_id, off.product_id),
    'manual_label', l.manual_label,
    'offer_label', COALESCE(p.name, l.manual_label),
    'quantity', l.quantity,
    'unit_price_excl_vat', l.unit_price_excl_vat,
    'vat_rate', l.vat_rate,
    'unit_cost_excl_vat', COALESCE(l.cost_price::text, ''),
    'commission_rate', CASE
      WHEN vt.commission_rate_override IS NOT NULL THEN vt.commission_rate_override::text
      WHEN vt.commission_amount_override IS NOT NULL AND COALESCE(vt.vendor_subtotal_excl_vat, 0) > 0 THEN round((vt.commission_amount_override / vt.vendor_subtotal_excl_vat) * 100.0, 4)::text
      ELSE ''
    END,
    'commission_amount', '',
    'commission_basis', 'ca'
  ) ORDER BY l.id), '[]'::jsonb)
  INTO v_lines
  FROM public.order_lines l
  LEFT JOIN vendor_totals vt ON vt.vendor_id = l.vendor_id
  LEFT JOIN public.offers off ON off.id = l.offer_id
  LEFT JOIN public.products p ON p.id = COALESCE(l.product_id, off.product_id)
  WHERE l.order_id = _order_id;

  RETURN jsonb_build_object(
    'customer_id', v_order.customer_id,
    'status', v_order.status,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'admin_notes', v_order.admin_notes,
    'encoding_at', to_char(v_order.created_at, 'YYYY-MM-DD"T"HH24:MI'),
    'is_forecast', COALESCE(v_order.is_forecast, false),
    'fulfillment_mode', v_order.fulfillment_mode,
    'shipping_address_id', v_order.shipping_address_id,
    'shipping_address', v_order.shipping_address,
    'lines', v_lines
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_load_order_for_edit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_load_order_for_edit(uuid) TO authenticated;