
CREATE OR REPLACE FUNCTION public.admin_duplicate_order_payload(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_lines jsonb;
  v_draft_lines jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  WITH vendor_totals AS (
    SELECT
      ol.vendor_id,
      SUM(ol.line_total_excl_vat) AS vendor_subtotal_excl_vat,
      MAX(so.commission_rate_override) FILTER (WHERE so.commission_rate_override IS NOT NULL AND so.commission_rate_override > 0) AS commission_rate_override,
      MAX(so.commission_amount_override) FILTER (WHERE so.commission_amount_override IS NOT NULL AND so.commission_amount_override > 0) AS commission_amount_override
    FROM public.order_lines ol
    LEFT JOIN public.sub_orders so
      ON so.order_id = ol.order_id
     AND so.vendor_id = ol.vendor_id
    WHERE ol.order_id = _order_id
    GROUP BY ol.vendor_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'mode', CASE WHEN ol.offer_id IS NOT NULL OR COALESCE(ol.product_id, off.product_id) IS NOT NULL THEN 'offer' ELSE 'free' END,
    'vendor_id', ol.vendor_id,
    'offer_id', ol.offer_id,
    'product_id', COALESCE(ol.product_id, off.product_id),
    'offer_label', COALESCE(p.name, ol.manual_label),
    'manual_label', ol.manual_label,
    'quantity', ol.quantity,
    'unit_price_excl_vat', ol.unit_price_excl_vat,
    'vat_rate', ol.vat_rate,
    'unit_cost_excl_vat', COALESCE(ol.cost_price::text, ''),
    'commission_rate', CASE
      WHEN ol.commission_rate IS NOT NULL THEN ol.commission_rate::text
      WHEN ol.commission_amount IS NOT NULL THEN ''
      WHEN vt.commission_rate_override IS NOT NULL THEN vt.commission_rate_override::text
      WHEN vt.commission_amount_override IS NOT NULL AND COALESCE(vt.vendor_subtotal_excl_vat, 0) > 0
        THEN round((vt.commission_amount_override / vt.vendor_subtotal_excl_vat) * 100.0, 4)::text
      ELSE ''
    END,
    'commission_amount', CASE
      WHEN ol.commission_amount IS NOT NULL THEN ol.commission_amount::text
      ELSE ''
    END,
    'commission_basis', COALESCE(ol.commission_basis, 'ca'),
    'gtin', p.gtin,
    'cnk_code', (SELECT code FROM public.product_market_codes pmc WHERE pmc.product_id = p.id AND pmc.code_type = 'cnk' LIMIT 1)
  ) ORDER BY ol.id), '[]'::jsonb)
  INTO v_lines
  FROM public.order_lines ol
  LEFT JOIN vendor_totals vt ON vt.vendor_id = ol.vendor_id
  LEFT JOIN public.offers off ON off.id = ol.offer_id
  LEFT JOIN public.products p ON p.id = COALESCE(ol.product_id, off.product_id)
  WHERE ol.order_id = _order_id;

  -- Fallback: if there are no order_lines (draft / forecast), take lines from draft_payload
  IF v_lines IS NULL OR jsonb_array_length(v_lines) = 0 THEN
    v_draft_lines := COALESCE(v_order.draft_payload -> 'lines', '[]'::jsonb);
    IF jsonb_array_length(v_draft_lines) > 0 THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', gen_random_uuid()::text,
        'mode', COALESCE(l->>'mode', CASE WHEN (l->>'offer_id') IS NOT NULL OR (l->>'product_id') IS NOT NULL THEN 'offer' ELSE 'free' END),
        'vendor_id', l->>'vendor_id',
        'offer_id', NULLIF(l->>'offer_id',''),
        'product_id', NULLIF(l->>'product_id',''),
        'offer_label', l->>'offer_label',
        'manual_label', l->>'manual_label',
        'quantity', COALESCE((l->>'quantity')::numeric, 1),
        'unit_price_excl_vat', COALESCE((l->>'unit_price_excl_vat')::numeric, 0),
        'vat_rate', COALESCE((l->>'vat_rate')::numeric, 21),
        'unit_cost_excl_vat', COALESCE(l->>'unit_cost_excl_vat',''),
        'commission_rate', COALESCE(l->>'commission_rate',''),
        'commission_amount', COALESCE(l->>'commission_amount',''),
        'commission_basis', COALESCE(l->>'commission_basis','ca'),
        'gtin', l->>'gtin',
        'cnk_code', l->>'cnk_code'
      )), '[]'::jsonb)
      INTO v_lines
      FROM jsonb_array_elements(v_draft_lines) AS l;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'source_order_id', v_order.id,
    'source_order_number', v_order.order_number,
    'customer_id', v_order.customer_id,
    'status', v_order.status::text,
    'payment_method', v_order.payment_method::text,
    'payment_status', v_order.payment_status::text,
    'admin_notes', v_order.admin_notes,
    'fulfillment_mode', v_order.fulfillment_mode::text,
    'shipping_address_id', v_order.shipping_address_id,
    'lines', COALESCE(v_lines, '[]'::jsonb)
  );
END;
$function$;
