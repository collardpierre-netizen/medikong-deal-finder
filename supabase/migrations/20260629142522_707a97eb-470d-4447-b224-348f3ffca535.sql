CREATE OR REPLACE FUNCTION public.public_get_order_by_token(_token text, _pin text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_customer jsonb;
  v_lines jsonb;
  v_vendor_bank jsonb;
  v_subtotal numeric := 0;
  v_vat numeric := 0;
  v_total numeric := 0;
  v_draft_lines jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_order.public_access_expires_at IS NOT NULL AND v_order.public_access_expires_at < now() THEN
    RETURN jsonb_build_object('expired', true);
  END IF;

  IF v_order.public_access_pin IS NOT NULL THEN
    IF _pin IS NULL OR _pin = '' THEN
      RETURN jsonb_build_object('requires_pin', true);
    END IF;
    IF _pin <> v_order.public_access_pin THEN
      RETURN jsonb_build_object('requires_pin', true, 'invalid_pin', true);
    END IF;
  END IF;

  SELECT to_jsonb(c) - 'created_at' - 'updated_at'
    INTO v_customer FROM public.customers c WHERE c.id = v_order.customer_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ol.id, 'quantity', ol.quantity,
    'unit_price_excl_vat', ol.unit_price_excl_vat, 'vat_rate', ol.vat_rate,
    'line_total_excl_vat', ol.line_total_excl_vat, 'manual_label', ol.manual_label,
    'product_name', p.name, 'vendor_name', coalesce(v.company_name, v.name)
  ) ORDER BY ol.id), '[]'::jsonb)
  INTO v_lines FROM public.order_lines ol
  LEFT JOIN public.products p ON p.id = ol.product_id
  LEFT JOIN public.vendors v ON v.id = ol.vendor_id
  WHERE ol.order_id = v_order.id;

  IF (v_lines = '[]'::jsonb OR v_lines IS NULL)
     AND v_order.draft_payload IS NOT NULL
     AND jsonb_typeof(v_order.draft_payload->'lines') = 'array' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', coalesce(l->>'id', 'draft-' || idx::text),
      'quantity', coalesce((l->>'quantity')::numeric, 0),
      'unit_price_excl_vat', coalesce((l->>'unit_price_excl_vat')::numeric, 0),
      'vat_rate', coalesce((l->>'vat_rate')::numeric, 0),
      'line_total_excl_vat', coalesce((l->>'quantity')::numeric, 0) * coalesce((l->>'unit_price_excl_vat')::numeric, 0),
      'manual_label', coalesce(l->>'manual_label', l->>'offer_label', p.name),
      'product_name', p.name, 'vendor_name', coalesce(v.company_name, v.name)
    ) ORDER BY idx), '[]'::jsonb)
    INTO v_draft_lines
    FROM jsonb_array_elements(v_order.draft_payload->'lines') WITH ORDINALITY AS t(l, idx)
    LEFT JOIN public.products p ON p.id::text = (l->>'product_id')
    LEFT JOIN public.vendors v ON v.id::text = (l->>'vendor_id');
    v_lines := v_draft_lines;
    SELECT coalesce(sum((l->>'line_total_excl_vat')::numeric), 0),
           coalesce(sum((l->>'line_total_excl_vat')::numeric * (l->>'vat_rate')::numeric / 100.0), 0)
    INTO v_subtotal, v_vat FROM jsonb_array_elements(v_draft_lines) AS l;
    v_total := v_subtotal + v_vat;
  ELSE
    v_subtotal := coalesce(v_order.subtotal_excl_vat, 0);
    v_vat := coalesce(v_order.vat_amount, 0);
    v_total := coalesce(v_order.total_incl_vat, 0);
  END IF;

  IF coalesce(v_order.show_payment_info, true) THEN
    SELECT to_jsonb(v) - 'created_at' - 'updated_at' - 'auth_user_id' - 'email'
      INTO v_vendor_bank
      FROM public.vendors v
      JOIN public.order_lines ol ON ol.vendor_id = v.id
      WHERE ol.order_id = v_order.id AND (v.iban IS NOT NULL OR v.bank_name IS NOT NULL)
      LIMIT 1;

    IF v_vendor_bank IS NULL AND v_order.draft_payload IS NOT NULL
       AND jsonb_typeof(v_order.draft_payload->'lines') = 'array' THEN
      SELECT to_jsonb(vv) - 'created_at' - 'updated_at' - 'auth_user_id' - 'email'
        INTO v_vendor_bank FROM public.vendors vv
        WHERE vv.id::text IN (
          SELECT l->>'vendor_id' FROM jsonb_array_elements(v_order.draft_payload->'lines') AS l WHERE l->>'vendor_id' IS NOT NULL
        )
        AND (vv.iban IS NOT NULL OR vv.bank_name IS NOT NULL)
        LIMIT 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_order.id, 'order_number', v_order.order_number, 'status', v_order.status,
    'created_at', v_order.created_at, 'subtotal_excl_vat', v_subtotal,
    'vat_amount', v_vat, 'total_incl_vat', v_total,
    'payment_method', v_order.payment_method, 'payment_status', v_order.payment_status,
    'payment_due_date', v_order.payment_due_date, 'notes', v_order.notes,
    'is_forecast', v_order.is_forecast, 'customer', v_customer, 'lines', v_lines,
    'vendor_bank', v_vendor_bank, 'draft_payload', v_order.draft_payload,
    'public_access_expires_at', v_order.public_access_expires_at
  );
END;
$function$;