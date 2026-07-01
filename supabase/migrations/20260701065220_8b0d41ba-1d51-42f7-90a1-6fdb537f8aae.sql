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
  v_shipping_address := CASE WHEN jsonb_typeof(_payload->'shipping_address') = 'object' THEN _payload->'shipping_address' ELSE '{}'::jsonb END;
  v_fingerprint := md5(_payload::text);

  IF _draft_id IS NOT NULL THEN
    PERFORM 1 FROM public.orders WHERE id = _draft_id AND status = 'draft' FOR UPDATE;
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
           shipping_address    = CASE WHEN v_fulfillment_mode = 'delivery' THEN v_shipping_address ELSE '{}'::jsonb END,
           updated_at          = now()
     WHERE id = _draft_id AND status = 'draft'
     RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

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
           shipping_address    = CASE WHEN v_fulfillment_mode = 'delivery' THEN v_shipping_address ELSE '{}'::jsonb END
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
      CASE WHEN v_fulfillment_mode = 'delivery' THEN v_shipping_address ELSE '{}'::jsonb END,
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
    UPDATE public.orders SET updated_at = now() WHERE id = v_id;
  END;

  RETURN v_id;
END
$function$;