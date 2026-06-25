CREATE OR REPLACE FUNCTION public.admin_update_manual_order(_order_id uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_status order_status;
  v_payment_method payment_method_enum;
  v_payment_status payment_status_enum;
  v_notes text;
  v_lines jsonb;
  v_line jsonb;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_vat_amount numeric := 0;
  v_line_excl numeric;
  v_line_incl numeric;
  v_vat_rate numeric;
  v_qty integer;
  v_unit_excl numeric;
  v_unit_cost numeric;
  v_line_cost numeric;
  v_line_commission numeric;
  v_line_rate numeric;
  v_line_amount numeric;
  v_line_basis text;
  v_commission_base numeric;
  v_vendor_id uuid;
  v_offer_id uuid;
  v_product_id uuid;
  v_manual_label text;
  v_sub_map jsonb := '{}'::jsonb;
  v_commission_map jsonb := '{}'::jsonb;
  v_sub_total numeric;
  v_vendor_key text;
  v_commission_rate numeric;
  v_commission_amount numeric;
  v_aggregated_commission numeric;
  v_created_at timestamptz;
  v_is_forecast boolean;
  v_fulfillment_mode text;
  v_shipping_address_id uuid;
  v_shipping_address jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id) THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  v_customer_id    := (_payload->>'customer_id')::uuid;
  v_status         := COALESCE((_payload->>'status')::order_status, 'confirmed');
  v_payment_method := COALESCE((_payload->>'payment_method')::payment_method_enum, 'invoice');
  v_payment_status := COALESCE((_payload->>'payment_status')::payment_status_enum, 'paid');
  v_notes          := _payload->>'admin_notes';
  v_lines          := _payload->'lines';
  v_created_at     := NULLIF(_payload->>'created_at', '')::timestamptz;
  v_is_forecast    := COALESCE((_payload->>'is_forecast')::boolean, false);
  v_fulfillment_mode := COALESCE(NULLIF(_payload->>'fulfillment_mode', ''), 'delivery');
  v_shipping_address_id := NULLIF(_payload->>'shipping_address_id', '')::uuid;
  v_shipping_address := COALESCE(_payload->'shipping_address', '{}'::jsonb);

  IF v_fulfillment_mode NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'invalid fulfillment_mode';
  END IF;

  IF v_fulfillment_mode = 'pickup' THEN
    v_shipping_address_id := NULL;
    v_shipping_address := '{}'::jsonb;
  END IF;

  IF v_created_at IS NOT NULL AND v_created_at > now() THEN
    v_is_forecast := true;
  END IF;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id required';
  END IF;
  IF v_lines IS NULL OR jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'at least one line required';
  END IF;

  DELETE FROM public.sub_orders WHERE order_id = _order_id;
  DELETE FROM public.order_items WHERE order_id = _order_id;
  DELETE FROM public.order_lines WHERE order_id = _order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines)
  LOOP
    v_vendor_id    := (v_line->>'vendor_id')::uuid;
    v_offer_id     := NULLIF(v_line->>'offer_id', '')::uuid;
    v_product_id   := NULLIF(v_line->>'product_id', '')::uuid;
    v_manual_label := v_line->>'manual_label';
    v_qty          := COALESCE((v_line->>'quantity')::int, 1);
    v_unit_excl    := COALESCE((v_line->>'unit_price_excl_vat')::numeric, 0);
    v_vat_rate     := COALESCE((v_line->>'vat_rate')::numeric, 21);
    v_unit_cost    := NULLIF(v_line->>'unit_cost_excl_vat', '')::numeric;
    v_line_rate    := NULLIF(v_line->>'commission_rate', '')::numeric;
    v_line_amount  := NULLIF(v_line->>'commission_amount', '')::numeric;
    v_line_basis   := COALESCE(NULLIF(v_line->>'commission_basis', ''), 'ca');

    IF v_vendor_id IS NULL THEN
      RAISE EXCEPTION 'vendor_id required on each line';
    END IF;

    v_line_excl := round(v_unit_excl * v_qty, 2);
    v_line_incl := round(v_line_excl * (1 + v_vat_rate/100.0), 2);
    v_line_cost := CASE WHEN v_unit_cost IS NOT NULL THEN round(v_unit_cost * v_qty, 2) ELSE NULL END;

    v_commission_base := CASE
      WHEN v_line_basis = 'margin' AND v_line_cost IS NOT NULL THEN v_line_excl - v_line_cost
      ELSE v_line_excl
    END;

    v_line_commission := COALESCE(
      CASE WHEN v_line_amount IS NOT NULL THEN round(v_line_amount * v_qty, 2) END,
      CASE WHEN v_line_rate IS NOT NULL THEN round(v_commission_base * v_line_rate / 100.0, 2) END,
      0
    );
    IF v_line_commission < 0 THEN v_line_commission := 0; END IF;

    INSERT INTO public.order_lines (
      order_id, offer_id, product_id, vendor_id, quantity,
      unit_price_excl_vat, unit_price_incl_vat, vat_rate,
      line_total_excl_vat, line_total_incl_vat,
      cost_price, line_cost, line_margin,
      fulfillment_type, fulfillment_status, manual_label
    ) VALUES (
      _order_id, v_offer_id, v_product_id, v_vendor_id, v_qty,
      v_unit_excl, round(v_unit_excl * (1 + v_vat_rate/100.0), 4), v_vat_rate,
      v_line_excl, v_line_incl,
      v_unit_cost, v_line_cost,
      CASE WHEN v_line_cost IS NOT NULL THEN round(v_line_excl - v_line_cost, 2) ELSE NULL END,
      'vendor_direct', 'pending', v_manual_label
    );

    INSERT INTO public.order_items (
      order_id, offer_id, product_id, quantity,
      unit_price_excl_vat, unit_price_incl_vat, vat_rate,
      line_total_excl_vat, line_total_incl_vat
    ) VALUES (
      _order_id, v_offer_id, v_product_id, v_qty,
      v_unit_excl, round(v_unit_excl * (1 + v_vat_rate/100.0), 4), v_vat_rate/100.0,
      v_line_excl, v_line_incl
    );

    v_subtotal := v_subtotal + v_line_excl;
    v_total    := v_total + v_line_incl;

    v_vendor_key := v_vendor_id::text;
    v_sub_total := COALESCE((v_sub_map->>v_vendor_key)::numeric, 0) + v_line_incl;
    v_sub_map := jsonb_set(v_sub_map, ARRAY[v_vendor_key], to_jsonb(v_sub_total));

    IF v_line_rate IS NOT NULL OR v_line_amount IS NOT NULL THEN
      v_aggregated_commission := COALESCE((v_commission_map->>v_vendor_key)::numeric, 0) + v_line_commission;
      v_commission_map := jsonb_set(v_commission_map, ARRAY[v_vendor_key], to_jsonb(v_aggregated_commission));
    END IF;
  END LOOP;

  v_vat_amount := v_total - v_subtotal;

  UPDATE public.orders SET
    customer_id       = v_customer_id,
    status            = v_status,
    payment_method    = v_payment_method,
    payment_status    = v_payment_status,
    admin_notes       = v_notes,
    is_forecast       = v_is_forecast,
    subtotal_excl_vat = v_subtotal,
    vat_amount        = v_vat_amount,
    total_incl_vat    = v_total,
    fulfillment_mode  = v_fulfillment_mode,
    shipping_address_id = v_shipping_address_id,
    shipping_address  = v_shipping_address,
    created_at        = COALESCE(v_created_at, created_at),
    updated_at        = now()
  WHERE id = _order_id;

  FOR v_vendor_key IN SELECT jsonb_object_keys(v_sub_map)
  LOOP
    v_sub_total       := (v_sub_map->>v_vendor_key)::numeric;
    v_commission_rate := NULLIF(_payload->'commissions'->v_vendor_key->>'rate', '')::numeric;
    v_commission_amount := NULLIF(_payload->'commissions'->v_vendor_key->>'amount', '')::numeric;

    IF v_commission_map ? v_vendor_key THEN
      v_commission_amount := (v_commission_map->>v_vendor_key)::numeric;
      v_commission_rate := NULL;
    END IF;

    INSERT INTO public.sub_orders (
      order_id, vendor_id, fulfillment_type, status,
      subtotal_incl_vat, payment_method, payment_status,
      commission_rate_override, commission_amount_override
    ) VALUES (
      _order_id, v_vendor_key::uuid, 'vendor_direct',
      CASE WHEN v_status = 'delivered' THEN 'delivered'::fulfillment_status
           WHEN v_status = 'shipped'   THEN 'shipped'::fulfillment_status
           ELSE 'pending'::fulfillment_status END,
      v_sub_total, v_payment_method, v_payment_status,
      v_commission_rate, v_commission_amount
    );
  END LOOP;

  RETURN jsonb_build_object('id', _order_id, 'updated', true);
END
$$;

CREATE OR REPLACE FUNCTION public.admin_create_manual_order(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_status order_status;
  v_payment_method payment_method_enum;
  v_payment_status payment_status_enum;
  v_notes text;
  v_lines jsonb;
  v_line jsonb;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_vat_amount numeric := 0;
  v_line_excl numeric;
  v_line_incl numeric;
  v_vat_rate numeric;
  v_qty integer;
  v_unit_excl numeric;
  v_unit_cost numeric;
  v_line_cost numeric;
  v_line_commission numeric;
  v_line_rate numeric;
  v_line_amount numeric;
  v_line_basis text;
  v_commission_base numeric;
  v_vendor_id uuid;
  v_offer_id uuid;
  v_product_id uuid;
  v_manual_label text;
  v_sub_map jsonb := '{}'::jsonb;
  v_commission_map jsonb := '{}'::jsonb;
  v_sub_total numeric;
  v_vendor_key text;
  v_commission_rate numeric;
  v_commission_amount numeric;
  v_aggregated_commission numeric;
  v_created_at timestamptz;
  v_is_forecast boolean;
  v_fulfillment_mode text;
  v_shipping_address_id uuid;
  v_shipping_address jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_customer_id    := (_payload->>'customer_id')::uuid;
  v_status         := COALESCE((_payload->>'status')::order_status, 'confirmed');
  v_payment_method := COALESCE((_payload->>'payment_method')::payment_method_enum, 'invoice');
  v_payment_status := COALESCE((_payload->>'payment_status')::payment_status_enum, 'paid');
  v_notes          := _payload->>'admin_notes';
  v_lines          := _payload->'lines';
  v_created_at     := NULLIF(_payload->>'created_at', '')::timestamptz;
  v_is_forecast    := COALESCE((_payload->>'is_forecast')::boolean, false);
  v_fulfillment_mode := COALESCE(NULLIF(_payload->>'fulfillment_mode', ''), 'delivery');
  v_shipping_address_id := NULLIF(_payload->>'shipping_address_id', '')::uuid;
  v_shipping_address := COALESCE(_payload->'shipping_address', '{}'::jsonb);

  IF v_created_at IS NULL THEN v_created_at := now(); END IF;
  IF v_created_at > now() THEN v_is_forecast := true; END IF;
  IF v_fulfillment_mode NOT IN ('pickup', 'delivery') THEN RAISE EXCEPTION 'invalid fulfillment_mode'; END IF;
  IF v_fulfillment_mode = 'pickup' THEN
    v_shipping_address_id := NULL;
    v_shipping_address := '{}'::jsonb;
  END IF;

  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'customer_id required'; END IF;
  IF v_lines IS NULL OR jsonb_array_length(v_lines) = 0 THEN RAISE EXCEPTION 'at least one line required'; END IF;

  v_order_number := 'MK-MANUAL-' || to_char(v_created_at, 'YYYY') || '-' || lpad((floor(random()*100000))::text, 5, '0');

  INSERT INTO public.orders (
    order_number, customer_id, source, status,
    subtotal_excl_vat, vat_amount, total_incl_vat,
    shipping_address, billing_address, shipping_address_id, fulfillment_mode,
    payment_method, payment_status,
    admin_notes, created_by_admin,
    created_at, is_forecast
  ) VALUES (
    v_order_number, v_customer_id, 'manual_admin', v_status,
    0, 0, 0,
    v_shipping_address, '{}'::jsonb, v_shipping_address_id, v_fulfillment_mode,
    v_payment_method, v_payment_status,
    v_notes, auth.uid(),
    v_created_at, v_is_forecast
  ) RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines)
  LOOP
    v_vendor_id    := (v_line->>'vendor_id')::uuid;
    v_offer_id     := NULLIF(v_line->>'offer_id', '')::uuid;
    v_product_id   := NULLIF(v_line->>'product_id', '')::uuid;
    v_manual_label := v_line->>'manual_label';
    v_qty          := COALESCE((v_line->>'quantity')::int, 1);
    v_unit_excl    := COALESCE((v_line->>'unit_price_excl_vat')::numeric, 0);
    v_vat_rate     := COALESCE((v_line->>'vat_rate')::numeric, 21);
    v_unit_cost    := NULLIF(v_line->>'unit_cost_excl_vat', '')::numeric;
    v_line_rate    := NULLIF(v_line->>'commission_rate', '')::numeric;
    v_line_amount  := NULLIF(v_line->>'commission_amount', '')::numeric;
    v_line_basis   := COALESCE(NULLIF(v_line->>'commission_basis', ''), 'ca');

    IF v_vendor_id IS NULL THEN RAISE EXCEPTION 'vendor_id required on each line'; END IF;

    v_line_excl := round(v_unit_excl * v_qty, 2);
    v_line_incl := round(v_line_excl * (1 + v_vat_rate/100.0), 2);
    v_line_cost := CASE WHEN v_unit_cost IS NOT NULL THEN round(v_unit_cost * v_qty, 2) ELSE NULL END;
    v_commission_base := CASE WHEN v_line_basis = 'margin' AND v_line_cost IS NOT NULL THEN v_line_excl - v_line_cost ELSE v_line_excl END;
    v_line_commission := COALESCE(
      CASE WHEN v_line_amount IS NOT NULL THEN round(v_line_amount * v_qty, 2) END,
      CASE WHEN v_line_rate IS NOT NULL THEN round(v_commission_base * v_line_rate / 100.0, 2) END,
      0
    );
    IF v_line_commission < 0 THEN v_line_commission := 0; END IF;

    INSERT INTO public.order_lines (
      order_id, offer_id, product_id, vendor_id, quantity,
      unit_price_excl_vat, unit_price_incl_vat, vat_rate,
      line_total_excl_vat, line_total_incl_vat,
      cost_price, line_cost, line_margin,
      fulfillment_type, fulfillment_status, manual_label
    ) VALUES (
      v_order_id, v_offer_id, v_product_id, v_vendor_id, v_qty,
      v_unit_excl, round(v_unit_excl * (1 + v_vat_rate/100.0), 4), v_vat_rate,
      v_line_excl, v_line_incl,
      v_unit_cost, v_line_cost,
      CASE WHEN v_line_cost IS NOT NULL THEN round(v_line_excl - v_line_cost, 2) ELSE NULL END,
      'vendor_direct', 'pending', v_manual_label
    );

    INSERT INTO public.order_items (
      order_id, offer_id, product_id, quantity,
      unit_price_excl_vat, unit_price_incl_vat, vat_rate,
      line_total_excl_vat, line_total_incl_vat
    ) VALUES (
      v_order_id, v_offer_id, v_product_id, v_qty,
      v_unit_excl, round(v_unit_excl * (1 + v_vat_rate/100.0), 4), v_vat_rate/100.0,
      v_line_excl, v_line_incl
    );

    v_subtotal := v_subtotal + v_line_excl;
    v_total    := v_total + v_line_incl;
    v_vendor_key := v_vendor_id::text;
    v_sub_total := COALESCE((v_sub_map->>v_vendor_key)::numeric, 0) + v_line_incl;
    v_sub_map := jsonb_set(v_sub_map, ARRAY[v_vendor_key], to_jsonb(v_sub_total));

    IF v_line_rate IS NOT NULL OR v_line_amount IS NOT NULL THEN
      v_aggregated_commission := COALESCE((v_commission_map->>v_vendor_key)::numeric, 0) + v_line_commission;
      v_commission_map := jsonb_set(v_commission_map, ARRAY[v_vendor_key], to_jsonb(v_aggregated_commission));
    END IF;
  END LOOP;

  v_vat_amount := v_total - v_subtotal;

  UPDATE public.orders SET
    subtotal_excl_vat = v_subtotal,
    vat_amount        = v_vat_amount,
    total_incl_vat    = v_total
  WHERE id = v_order_id;

  FOR v_vendor_key IN SELECT jsonb_object_keys(v_sub_map)
  LOOP
    v_sub_total       := (v_sub_map->>v_vendor_key)::numeric;
    v_commission_rate := NULLIF(_payload->'commissions'->v_vendor_key->>'rate', '')::numeric;
    v_commission_amount := NULLIF(_payload->'commissions'->v_vendor_key->>'amount', '')::numeric;

    IF v_commission_map ? v_vendor_key THEN
      v_commission_amount := (v_commission_map->>v_vendor_key)::numeric;
      v_commission_rate := NULL;
    END IF;

    INSERT INTO public.sub_orders (
      order_id, vendor_id, fulfillment_type, status,
      subtotal_incl_vat, payment_method, payment_status,
      commission_rate_override, commission_amount_override
    ) VALUES (
      v_order_id, v_vendor_key::uuid, 'vendor_direct',
      CASE WHEN v_status = 'delivered' THEN 'delivered'::fulfillment_status
           WHEN v_status = 'shipped'   THEN 'shipped'::fulfillment_status
           ELSE 'pending'::fulfillment_status END,
      v_sub_total, v_payment_method, v_payment_status,
      v_commission_rate, v_commission_amount
    );
  END LOOP;

  RETURN jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total_incl_vat', v_total, 'is_forecast', v_is_forecast);
END
$$;

REVOKE ALL ON FUNCTION public.admin_update_manual_order(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_manual_order(uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_create_manual_order(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_manual_order(jsonb) TO authenticated, service_role;