ALTER TABLE public.order_lines ADD COLUMN IF NOT EXISTS commission_computed numeric;

-- Backfill: la valeur historiquement stockée dans commission_amount est la commission calculée totale
UPDATE public.order_lines
SET commission_computed = commission_amount
WHERE commission_computed IS NULL AND commission_amount IS NOT NULL;

-- Nettoyage: lignes où un % est encodé => commission_amount (€/unité saisi) doit être vide
UPDATE public.order_lines
SET commission_amount = NULL
WHERE commission_rate IS NOT NULL AND commission_amount IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_create_manual_order(_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_status order_status;
  v_payment_method payment_method_enum;
  v_payment_status payment_status_enum;
  v_notes text;
  v_created_at timestamptz;
  v_is_forecast boolean;
  v_fulfillment_mode text;
  v_shipping_address_id uuid;
  v_shipping_address jsonb;
  v_order_id uuid;
  v_order_number text;
  v_lines jsonb;
  v_line jsonb;
  v_vendor_id uuid;
  v_offer_id uuid;
  v_product_id uuid;
  v_manual_label text;
  v_qty int;
  v_unit_excl numeric;
  v_vat_rate numeric;
  v_unit_cost numeric;
  v_line_rate numeric;
  v_line_amount numeric;
  v_line_basis text;
  v_line_excl numeric;
  v_line_incl numeric;
  v_line_cost numeric;
  v_line_commission numeric;
  v_commission_base numeric;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_vat_amount numeric;
  v_vendor_key text;
  v_sub_total numeric;
  v_sub_map jsonb := '{}'::jsonb;
  v_commission_map jsonb := '{}'::jsonb;
  v_aggregated_commission numeric;
  v_commission_rate numeric;
  v_commission_amount numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_customer_id := (_payload->>'customer_id')::uuid;
  v_status := COALESCE(NULLIF(_payload->>'status',''), 'confirmed')::order_status;
  v_payment_method := COALESCE(NULLIF(_payload->>'payment_method',''), 'invoice')::payment_method_enum;
  v_payment_status := COALESCE(NULLIF(_payload->>'payment_status',''), 'paid')::payment_status_enum;
  v_notes := _payload->>'admin_notes';
  v_created_at := NULLIF(_payload->>'created_at','')::timestamptz;
  v_is_forecast := COALESCE((_payload->>'is_forecast')::boolean, false);
  v_fulfillment_mode := COALESCE(NULLIF(_payload->>'fulfillment_mode',''), 'pickup');
  v_shipping_address_id := NULLIF(_payload->>'shipping_address_id','')::uuid;
  v_shipping_address := _payload->'shipping_address';
  v_lines := _payload->'lines';

  v_order_number := 'MK-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random()*100000))::text, 5, '0');

  INSERT INTO public.orders (
    customer_id, order_number, status, payment_method, payment_status,
    subtotal_excl_vat, vat_amount, total_incl_vat,
    fulfillment_mode, shipping_address_id, shipping_address,
    admin_notes, created_by_admin, created_at, is_forecast, source
  ) VALUES (
    v_customer_id, v_order_number, v_status, v_payment_method, v_payment_status,
    0, 0, 0,
    v_fulfillment_mode, v_shipping_address_id, v_shipping_address,
    v_notes, auth.uid(),
    COALESCE(v_created_at, now()), v_is_forecast, 'manual_admin'
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
    v_line_rate    := NULLIF(NULLIF(v_line->>'commission_rate', '')::numeric, 0);
    v_line_amount  := NULLIF(NULLIF(v_line->>'commission_amount', '')::numeric, 0);
    v_line_basis   := COALESCE(NULLIF(v_line->>'commission_basis', ''), 'ca');

    -- Exclusivité stricte : un % encodé annule le €/unité fixe
    IF v_line_rate IS NOT NULL THEN
      v_line_amount := NULL;
    END IF;

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
      fulfillment_type, fulfillment_status, manual_label,
      commission_rate, commission_amount, commission_computed, commission_basis
    ) VALUES (
      v_order_id, v_offer_id, v_product_id, v_vendor_id, v_qty,
      v_unit_excl, round(v_unit_excl * (1 + v_vat_rate/100.0), 4), v_vat_rate,
      v_line_excl, v_line_incl,
      v_unit_cost, v_line_cost,
      CASE WHEN v_line_cost IS NOT NULL THEN round(v_line_excl - v_line_cost, 2) ELSE NULL END,
      'vendor_direct', 'pending', v_manual_label,
      v_line_rate, v_line_amount, v_line_commission, v_line_basis
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_load_order_for_edit(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_lines jsonb;
  v_header jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  v_header := jsonb_build_object(
    'customer_id', v_order.customer_id,
    'status', v_order.status,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'admin_notes', v_order.admin_notes,
    'encoding_at', to_char(v_order.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI'),
    'is_forecast', COALESCE(v_order.is_forecast, false),
    'fulfillment_mode', v_order.fulfillment_mode,
    'shipping_address_id', v_order.shipping_address_id,
    'shipping_address', v_order.shipping_address
  );

  IF v_order.draft_payload IS NOT NULL AND jsonb_array_length(COALESCE(v_order.draft_payload->'lines','[]'::jsonb)) > 0 THEN
    IF v_order.status = 'draft' THEN
      RETURN v_header || COALESCE(v_order.draft_payload, '{}'::jsonb);
    END IF;
    RETURN COALESCE(v_order.draft_payload, '{}'::jsonb) || v_header;
  END IF;

  WITH vendor_totals AS (
    SELECT
      ol.vendor_id,
      SUM(ol.line_total_excl_vat) AS vendor_subtotal_excl_vat,
      SUM(CASE WHEN ol.line_cost IS NOT NULL THEN ol.line_total_excl_vat - ol.line_cost ELSE NULL END) AS vendor_margin_excl_vat,
      BOOL_OR(ol.line_cost IS NOT NULL) AS has_margin_base,
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
      WHEN l.commission_rate IS NOT NULL THEN l.commission_rate::text
      WHEN l.commission_amount IS NOT NULL THEN ''
      WHEN vt.commission_rate_override IS NOT NULL THEN vt.commission_rate_override::text
      WHEN vt.commission_amount_override IS NOT NULL
       AND COALESCE(vt.has_margin_base, false)
       AND COALESCE(vt.vendor_margin_excl_vat, 0) > 0
       AND abs(vt.commission_amount_override - (vt.vendor_margin_excl_vat * 0.5)) <= 0.02
        THEN '50'
      WHEN vt.commission_amount_override IS NOT NULL AND COALESCE(vt.vendor_subtotal_excl_vat, 0) > 0 THEN round((vt.commission_amount_override / vt.vendor_subtotal_excl_vat) * 100.0, 4)::text
      ELSE ''
    END,
    'commission_amount', CASE
      WHEN l.commission_rate IS NOT NULL THEN ''
      WHEN l.commission_amount IS NOT NULL THEN l.commission_amount::text
      ELSE ''
    END,
    'commission_computed', COALESCE(l.commission_computed, l.commission_amount),
    'commission_basis', CASE
      WHEN l.commission_basis IS NOT NULL THEN l.commission_basis
      WHEN vt.commission_amount_override IS NOT NULL
       AND COALESCE(vt.has_margin_base, false)
       AND COALESCE(vt.vendor_margin_excl_vat, 0) > 0
       AND abs(vt.commission_amount_override - (vt.vendor_margin_excl_vat * 0.5)) <= 0.02
        THEN 'margin'
      ELSE 'ca'
    END,
    'gtin', p.gtin,
    'cnk_code', p.cnk_code
  ) ORDER BY l.id), '[]'::jsonb)
  INTO v_lines
  FROM public.order_lines l
  LEFT JOIN vendor_totals vt ON vt.vendor_id = l.vendor_id
  LEFT JOIN public.offers off ON off.id = l.offer_id
  LEFT JOIN public.products p ON p.id = COALESCE(l.product_id, off.product_id)
  WHERE l.order_id = _order_id;

  RETURN v_header || jsonb_build_object('lines', v_lines);
END
$function$;