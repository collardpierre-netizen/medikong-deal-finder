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
      -- Pour un brouillon, les champs saisis dans le formulaire restent prioritaires.
      RETURN v_header || COALESCE(v_order.draft_payload, '{}'::jsonb);
    END IF;
    -- Pour une commande déjà active/confirmée, les colonnes réelles de la commande restent prioritaires.
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
      WHEN l.commission_amount IS NOT NULL THEN l.commission_amount::text
      ELSE ''
    END,
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

REVOKE ALL ON FUNCTION public.admin_load_order_for_edit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_load_order_for_edit(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_load_manual_order_draft(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_header jsonb;
BEGIN
  IF NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT * INTO v_order
    FROM public.orders
   WHERE id = _id AND status = 'draft';

  IF NOT FOUND OR v_order.draft_payload IS NULL THEN
    RAISE EXCEPTION 'draft not found';
  END IF;

  v_header := jsonb_build_object(
    'customer_id', v_order.customer_id,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'admin_notes', v_order.admin_notes,
    'encoding_at', to_char(v_order.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI'),
    'is_forecast', COALESCE(v_order.is_forecast, false),
    'fulfillment_mode', v_order.fulfillment_mode,
    'shipping_address_id', v_order.shipping_address_id,
    'shipping_address', v_order.shipping_address
  );

  RETURN v_header || v_order.draft_payload;
END
$function$;

REVOKE ALL ON FUNCTION public.admin_load_manual_order_draft(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_load_manual_order_draft(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_manual_order_draft(_draft_id uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_customer_id uuid;
  v_admin_notes text;
  v_payment_method payment_method_enum;
  v_payment_status payment_status_enum;
  v_created_at timestamptz;
  v_is_forecast boolean;
  v_fulfillment_mode text;
  v_shipping_address_id uuid;
  v_shipping_address jsonb;
  v_fingerprint text;
  v_lock_key bigint;
BEGIN
  IF NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid payload';
  END IF;

  v_customer_id := NULLIF(_payload->>'customer_id','')::uuid;
  v_admin_notes := NULLIF(_payload->>'admin_notes','');
  v_payment_method := COALESCE(NULLIF(_payload->>'payment_method','')::payment_method_enum, 'invoice');
  v_payment_status := COALESCE(NULLIF(_payload->>'payment_status','')::payment_status_enum, 'pending');
  v_created_at := COALESCE(NULLIF(_payload->>'created_at','')::timestamptz, NULLIF(_payload->>'encoding_at','')::timestamptz, now());
  v_is_forecast := COALESCE((_payload->>'is_forecast')::boolean, v_created_at > now());
  v_fulfillment_mode := COALESCE(NULLIF(_payload->>'fulfillment_mode',''), 'delivery');
  IF v_fulfillment_mode NOT IN ('delivery', 'pickup') THEN
    v_fulfillment_mode := 'delivery';
  END IF;
  v_shipping_address_id := NULLIF(_payload->>'shipping_address_id','')::uuid;
  v_shipping_address := CASE WHEN jsonb_typeof(_payload->'shipping_address') = 'object' THEN _payload->'shipping_address' ELSE NULL END;
  v_fingerprint := md5(_payload::text);

  IF _draft_id IS NOT NULL THEN
    PERFORM 1
       FROM public.orders
      WHERE id = _draft_id
        AND status = 'draft'
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'draft not found or not a draft';
    END IF;

    UPDATE public.orders
       SET draft_payload       = _payload,
           draft_fingerprint   = v_fingerprint,
           customer_id         = COALESCE(v_customer_id, customer_id),
           admin_notes         = v_admin_notes,
           payment_method      = v_payment_method,
           payment_status      = v_payment_status,
           created_at          = v_created_at,
           is_forecast         = v_is_forecast,
           fulfillment_mode    = v_fulfillment_mode,
           shipping_address_id = CASE WHEN v_fulfillment_mode = 'delivery' THEN v_shipping_address_id ELSE NULL END,
           shipping_address    = CASE WHEN v_fulfillment_mode = 'delivery' THEN v_shipping_address ELSE NULL END,
           updated_at          = now()
     WHERE id = _draft_id
       AND status = 'draft'
     RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id required to create a draft';
  END IF;

  v_lock_key := ('x' || substr(md5(v_uid::text || ':' || v_customer_id::text || ':' || v_fingerprint), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT id INTO v_id
    FROM public.orders
   WHERE status = 'draft'
     AND created_by_admin = v_uid
     AND customer_id = v_customer_id
     AND draft_fingerprint = v_fingerprint
   ORDER BY updated_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_id IS NOT NULL THEN
    UPDATE public.orders
       SET updated_at          = now(),
           admin_notes         = v_admin_notes,
           payment_method      = v_payment_method,
           payment_status      = v_payment_status,
           created_at          = v_created_at,
           is_forecast         = v_is_forecast,
           fulfillment_mode    = v_fulfillment_mode,
           shipping_address_id = CASE WHEN v_fulfillment_mode = 'delivery' THEN v_shipping_address_id ELSE NULL END,
           shipping_address    = CASE WHEN v_fulfillment_mode = 'delivery' THEN v_shipping_address ELSE NULL END
     WHERE id = v_id;
    RETURN v_id;
  END IF;

  BEGIN
    INSERT INTO public.orders (
      customer_id, source, status,
      payment_method, payment_status,
      admin_notes, draft_payload, draft_fingerprint, created_by_admin,
      order_number, created_at, is_forecast, fulfillment_mode, shipping_address_id, shipping_address,
      subtotal_excl_vat, vat_amount, total_incl_vat
    ) VALUES (
      v_customer_id, 'web'::order_source, 'draft'::order_status,
      v_payment_method, v_payment_status,
      v_admin_notes, _payload, v_fingerprint, v_uid,
      'DRAFT-' || to_char(now(),'YYYYMMDD-HH24MISS') || '-' || substr(gen_random_uuid()::text,1,4),
      v_created_at, v_is_forecast, v_fulfillment_mode,
      CASE WHEN v_fulfillment_mode = 'delivery' THEN v_shipping_address_id ELSE NULL END,
      CASE WHEN v_fulfillment_mode = 'delivery' THEN v_shipping_address ELSE NULL END,
      0, 0, 0
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id
      FROM public.orders
     WHERE status = 'draft'
       AND created_by_admin = v_uid
       AND customer_id = v_customer_id
       AND draft_fingerprint = v_fingerprint
     ORDER BY updated_at DESC
     LIMIT 1;
    IF v_id IS NULL THEN
      RAISE;
    END IF;
    UPDATE public.orders
       SET updated_at = now()
     WHERE id = v_id;
  END;

  RETURN v_id;
END
$function$;

REVOKE ALL ON FUNCTION public.admin_save_manual_order_draft(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_manual_order_draft(uuid, jsonb) TO authenticated;