ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_validation_email text;

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
  v_shipping_address := _payload->'shipping_address';

  IF v_fulfillment_mode NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'invalid fulfillment_mode';
  END IF;

  IF v_fulfillment_mode = 'pickup' THEN
    v_shipping_address_id := NULL;
    v_shipping_address := NULL;
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

CREATE OR REPLACE FUNCTION public.admin_duplicate_order_payload(_order_id uuid)
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
      WHEN vt.commission_rate_override IS NOT NULL THEN vt.commission_rate_override::text
      WHEN vt.commission_amount_override IS NOT NULL AND COALESCE(vt.vendor_subtotal_excl_vat, 0) > 0 THEN round((vt.commission_amount_override / vt.vendor_subtotal_excl_vat) * 100.0, 4)::text
      ELSE ''
    END,
    'commission_amount', '',
    'commission_basis', 'ca'
  ) ORDER BY ol.id), '[]'::jsonb)
  INTO v_lines
  FROM public.order_lines ol
  LEFT JOIN vendor_totals vt ON vt.vendor_id = ol.vendor_id
  LEFT JOIN public.offers off ON off.id = ol.offer_id
  LEFT JOIN public.products p ON p.id = COALESCE(ol.product_id, off.product_id)
  WHERE ol.order_id = _order_id;

  RETURN jsonb_build_object(
    'source_order_id', v_order.id,
    'source_order_number', v_order.order_number,
    'customer_id', v_order.customer_id,
    'status', v_order.status::text,
    'payment_method', v_order.payment_method::text,
    'payment_status', v_order.payment_status::text,
    'admin_notes', v_order.admin_notes,
    'fulfillment_mode', v_order.fulfillment_mode,
    'shipping_address_id', v_order.shipping_address_id,
    'shipping_address', v_order.shipping_address,
    'lines', v_lines
  );
END
$$;

CREATE OR REPLACE FUNCTION public.public_get_order_by_token(_token text, _pin text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

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
    INTO v_customer
    FROM public.customers c WHERE c.id = v_order.customer_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ol.id,
    'quantity', ol.quantity,
    'unit_price_excl_vat', ol.unit_price_excl_vat,
    'vat_rate', ol.vat_rate,
    'line_total_excl_vat', ol.line_total_excl_vat,
    'manual_label', ol.manual_label,
    'product_name', p.name,
    'vendor_name', coalesce(v.company_name, v.name)
  ) ORDER BY ol.id), '[]'::jsonb)
  INTO v_lines
  FROM public.order_lines ol
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
      'product_name', p.name,
      'vendor_name', coalesce(v.company_name, v.name)
    ) ORDER BY idx), '[]'::jsonb)
    INTO v_draft_lines
    FROM jsonb_array_elements(v_order.draft_payload->'lines') WITH ORDINALITY AS t(l, idx)
    LEFT JOIN public.products p ON p.id::text = (l->>'product_id')
    LEFT JOIN public.vendors v ON v.id::text = (l->>'vendor_id');

    v_lines := v_draft_lines;

    SELECT
      coalesce(sum((l->>'line_total_excl_vat')::numeric), 0),
      coalesce(sum((l->>'line_total_excl_vat')::numeric * (l->>'vat_rate')::numeric / 100.0), 0)
    INTO v_subtotal, v_vat
    FROM jsonb_array_elements(v_draft_lines) AS l;
    v_total := v_subtotal + v_vat;
  ELSE
    v_subtotal := coalesce(v_order.subtotal_excl_vat, 0);
    v_vat := coalesce(v_order.vat_amount, 0);
    v_total := coalesce(v_order.total_incl_vat, 0);
  END IF;

  SELECT to_jsonb(v) - 'created_at' - 'updated_at' - 'auth_user_id' - 'email'
    INTO v_vendor_bank
    FROM public.vendors v
    JOIN public.order_lines ol ON ol.vendor_id = v.id
    WHERE ol.order_id = v_order.id AND (v.iban IS NOT NULL OR v.bank_name IS NOT NULL)
    LIMIT 1;

  IF v_vendor_bank IS NULL AND v_order.draft_payload IS NOT NULL
     AND jsonb_typeof(v_order.draft_payload->'lines') = 'array' THEN
    SELECT to_jsonb(vv) - 'created_at' - 'updated_at' - 'auth_user_id' - 'email'
      INTO v_vendor_bank
      FROM public.vendors vv
      WHERE vv.id::text IN (
        SELECT l->>'vendor_id' FROM jsonb_array_elements(v_order.draft_payload->'lines') AS l WHERE l->>'vendor_id' IS NOT NULL
      )
      AND (vv.iban IS NOT NULL OR vv.bank_name IS NOT NULL)
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
    'customer', v_customer,
    'lines', v_lines,
    'vendor_bank', v_vendor_bank,
    'draft_payload', v_order.draft_payload,
    'public_access_expires_at', v_order.public_access_expires_at,
    'fulfillment_mode', v_order.fulfillment_mode,
    'shipping_address', v_order.shipping_address,
    'customer_validated_at', v_order.customer_validated_at,
    'customer_validation_email', v_order.customer_validation_email
  );
END
$$;

CREATE OR REPLACE FUNCTION public.public_validate_order(_token text, _pin text DEFAULT NULL::text, _email text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_email text;
BEGIN
  v_email := lower(trim(coalesce(_email, '')));
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'email invalide';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE public_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'commande introuvable';
  END IF;

  IF v_order.public_access_expires_at IS NOT NULL AND v_order.public_access_expires_at < now() THEN
    RAISE EXCEPTION 'lien expiré';
  END IF;

  IF v_order.public_access_pin IS NOT NULL AND (_pin IS NULL OR _pin <> v_order.public_access_pin) THEN
    RAISE EXCEPTION 'code incorrect';
  END IF;

  UPDATE public.orders
  SET customer_validated_at = now(),
      customer_validation_email = v_email,
      status = CASE WHEN status IN ('draft'::order_status, 'pending'::order_status) THEN 'confirmed'::order_status ELSE status END,
      updated_at = now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object('ok', true, 'validated_at', now(), 'email', v_email);
END
$$;

REVOKE ALL ON FUNCTION public.admin_update_manual_order(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_manual_order(uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_duplicate_order_payload(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_duplicate_order_payload(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.public_get_order_by_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_order_by_token(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.public_validate_order(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_validate_order(text, text, text) TO anon, authenticated;