
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
  v_fingerprint := md5(_payload::text);

  -- Branche UPDATE explicite : verrou ligne via SELECT FOR UPDATE
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
       SET draft_payload  = _payload,
           customer_id    = COALESCE(v_customer_id, customer_id),
           admin_notes    = v_admin_notes,
           payment_method = v_payment_method,
           payment_status = v_payment_status,
           updated_at     = now()
     WHERE id = _draft_id
       AND status = 'draft'
     RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- Branche CRÉATION : sérialisation par (admin, client, empreinte) via advisory lock transactionnel
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id required to create a draft';
  END IF;

  -- Clé bigint stable dérivée du triplet ; pg_advisory_xact_lock se libère à la fin de la transaction
  v_lock_key := ('x' || substr(md5(v_uid::text || ':' || v_customer_id::text || ':' || v_fingerprint), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Recherche d'un brouillon strictement identique (avec verrou pour bloquer toute mutation concurrente)
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
       SET updated_at     = now(),
           admin_notes    = v_admin_notes,
           payment_method = v_payment_method,
           payment_status = v_payment_status
     WHERE id = v_id;
    RETURN v_id;
  END IF;

  -- Insertion protégée : si l'index unique partiel saute (course extrême), on rattrape
  BEGIN
    INSERT INTO public.orders (
      customer_id, source, status,
      payment_method, payment_status,
      admin_notes, draft_payload, created_by_admin,
      order_number,
      subtotal_excl_vat, vat_amount, total_incl_vat
    ) VALUES (
      v_customer_id, 'web'::order_source, 'draft'::order_status,
      v_payment_method, v_payment_status,
      v_admin_notes, _payload, v_uid,
      'DRAFT-' || to_char(now(),'YYYYMMDD-HH24MISS') || '-' || substr(gen_random_uuid()::text,1,4),
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
