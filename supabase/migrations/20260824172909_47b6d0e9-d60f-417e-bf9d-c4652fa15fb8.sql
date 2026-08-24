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
  v_subtotal numeric;
  v_vat numeric;
  v_total numeric;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_order.public_access_expires_at IS NOT NULL AND v_order.public_access_expires_at < now() THEN
    RETURN jsonb_build_object('expired', true);
  END IF;

  IF v_order.public_access_pin IS NOT NULL AND length(v_order.public_access_pin) > 0 THEN
    IF _pin IS NULL OR length(_pin) = 0 THEN
      RETURN jsonb_build_object('requires_pin', true);
    ELSIF _pin <> v_order.public_access_pin THEN
      RETURN jsonb_build_object('requires_pin', true, 'invalid_pin', true);
    END IF;
  END IF;

  -- Totaux par défaut : colonnes de la commande (correctes une fois confirmée)
  v_subtotal := coalesce(v_order.subtotal_excl_vat, 0);
  v_vat      := coalesce(v_order.vat_amount, 0);
  v_total    := coalesce(v_order.total_incl_vat, 0);

  SELECT to_jsonb(c) - 'created_at' - 'updated_at'
    INTO v_customer FROM public.customers c WHERE c.id = v_order.customer_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ol.id,
    'quantity', ol.quantity,
    'quantity_shipped', ol.quantity_shipped,
    'unit_price_excl_vat', ol.unit_price_excl_vat,
    'vat_rate', ol.vat_rate,
    'line_total_excl_vat', ol.line_total_excl_vat,
    'manual_label', coalesce(ol.manual_label, p.name),
    'product_name', p.name,
    'product_gtin', p.gtin,
    'product_cnk', p.cnk_code,
    'fulfillment_status', ol.fulfillment_status,
    'tracking_number', ol.tracking_number,
    'tracking_url', ol.tracking_url,
    'vendor_name', coalesce(v.company_name, v.name)
  ) ORDER BY ol.id), '[]'::jsonb)
  INTO v_lines
  FROM public.order_lines ol
  LEFT JOIN public.products p ON p.id = ol.product_id
  LEFT JOIN public.vendors v ON v.id = ol.vendor_id
  WHERE ol.order_id = v_order.id;

  IF (v_lines IS NULL OR v_lines = '[]'::jsonb)
     AND v_order.draft_payload IS NOT NULL
     AND jsonb_typeof(v_order.draft_payload->'lines') = 'array' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', t.rn::text,
      'manual_label', coalesce(t.l->>'manual_label', t.l->>'offer_label', t.p_name),
      'product_name', t.p_name,
      'product_gtin', t.p_gtin,
      'product_cnk', t.p_cnk,
      'quantity', t.qty,
      'unit_price_excl_vat', t.unit_price,
      'vat_rate', t.vat_rate,
      'line_total_excl_vat', t.line_ht,
      'vendor_name', t.vendor_name
    ) ORDER BY t.rn), '[]'::jsonb)
    INTO v_lines
    FROM (
      SELECT row_number() OVER () AS rn,
             l,
             p.name AS p_name,
             p.gtin AS p_gtin,
             p.cnk_code AS p_cnk,
             coalesce(v.company_name, v.name) AS vendor_name,
             coalesce(nullif(l->>'quantity','')::numeric, 0) AS qty,
             coalesce(nullif(l->>'unit_price_excl_vat','')::numeric, 0) AS unit_price,
             coalesce(nullif(l->>'vat_rate','')::numeric, 0) AS vat_rate,
             coalesce(nullif(l->>'line_total_excl_vat','')::numeric,
                      coalesce(nullif(l->>'quantity','')::numeric, 0)
                      * coalesce(nullif(l->>'unit_price_excl_vat','')::numeric, 0)) AS line_ht
      FROM jsonb_array_elements(v_order.draft_payload->'lines') l
      LEFT JOIN public.products p ON p.id = nullif(l->>'product_id','')::uuid
      LEFT JOIN public.vendors v ON v.id = nullif(l->>'vendor_id','')::uuid
    ) t;

    -- Brouillon : les colonnes de totaux de la commande restent à 0,
    -- on recalcule depuis les lignes du brouillon.
    SELECT coalesce(sum(t.line_ht), 0),
           coalesce(sum(t.line_ht * t.vat_rate / 100), 0)
      INTO v_subtotal, v_vat
    FROM (
      SELECT coalesce(nullif(l->>'line_total_excl_vat','')::numeric,
                      coalesce(nullif(l->>'quantity','')::numeric, 0)
                      * coalesce(nullif(l->>'unit_price_excl_vat','')::numeric, 0)) AS line_ht,
             coalesce(nullif(l->>'vat_rate','')::numeric, 0) AS vat_rate
      FROM jsonb_array_elements(v_order.draft_payload->'lines') l
    ) t;
    v_total := v_subtotal + v_vat;
  END IF;

  IF coalesce(v_order.show_payment_info, true) THEN
    SELECT to_jsonb(v) - 'created_at' - 'updated_at' - 'auth_user_id' - 'email'
      INTO v_vendor_bank
      FROM public.vendors v
      JOIN public.order_lines ol ON ol.vendor_id = v.id
      WHERE ol.order_id = v_order.id AND (v.iban IS NOT NULL OR v.bank_name IS NOT NULL)
      LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'subtotal_excl_vat', v_subtotal,
    'vat_amount', v_vat,
    'total_incl_vat', v_total,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'payment_due_date', v_order.payment_due_date,
    'notes', v_order.notes,
    'is_forecast', v_order.is_forecast,
    'fulfillment_mode', v_order.fulfillment_mode,
    'shipping_address', v_order.shipping_address,
    'customer', v_customer,
    'lines', v_lines,
    'vendor_bank', v_vendor_bank,
    'public_access_expires_at', v_order.public_access_expires_at,
    'customer_validated_at', v_order.customer_validated_at,
    'customer_validation_email', v_order.customer_validation_email,
    'tracking_url', v_order.tracking_url,
    'tracking_carrier', v_order.tracking_carrier,
    'tracking_number', v_order.tracking_number,
    'shipped_at', v_order.shipped_at
  );
END;
$function$;