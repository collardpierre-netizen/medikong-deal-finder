
CREATE OR REPLACE FUNCTION public.admin_duplicate_order_payload(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'mode', CASE WHEN ol.offer_id IS NOT NULL OR ol.product_id IS NOT NULL THEN 'offer' ELSE 'free' END,
    'vendor_id', ol.vendor_id,
    'offer_id', ol.offer_id,
    'product_id', ol.product_id,
    'offer_label', COALESCE(p.name, ol.manual_label),
    'manual_label', ol.manual_label,
    'quantity', ol.quantity,
    'unit_price_excl_vat', ol.unit_price_excl_vat,
    'vat_rate', ol.vat_rate,
    'unit_cost_excl_vat', COALESCE(ol.cost_price::text, ''),
    'commission_rate', '',
    'commission_amount', '',
    'commission_basis', 'ca'
  ) ORDER BY ol.id), '[]'::jsonb)
  INTO v_lines
  FROM public.order_lines ol
  LEFT JOIN public.products p ON p.id = ol.product_id
  WHERE ol.order_id = _order_id;

  RETURN jsonb_build_object(
    'source_order_id', v_order.id,
    'source_order_number', v_order.order_number,
    'customer_id', v_order.customer_id,
    'status', v_order.status::text,
    'payment_method', v_order.payment_method::text,
    'payment_status', v_order.payment_status::text,
    'admin_notes', v_order.admin_notes,
    'lines', v_lines
  );
END;
$function$;
