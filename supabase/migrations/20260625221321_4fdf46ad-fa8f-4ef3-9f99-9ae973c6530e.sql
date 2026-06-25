
-- 1) Empreinte du brouillon
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS draft_fingerprint text;

CREATE OR REPLACE FUNCTION public.orders_set_draft_fingerprint()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'draft' AND NEW.draft_payload IS NOT NULL THEN
    NEW.draft_fingerprint := md5(NEW.draft_payload::text);
  ELSE
    NEW.draft_fingerprint := NULL;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_orders_set_draft_fingerprint ON public.orders;
CREATE TRIGGER trg_orders_set_draft_fingerprint
BEFORE INSERT OR UPDATE OF draft_payload, status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.orders_set_draft_fingerprint();

-- Backfill empreinte sur les brouillons existants
UPDATE public.orders
   SET draft_fingerprint = md5(draft_payload::text)
 WHERE status = 'draft'
   AND draft_payload IS NOT NULL
   AND draft_fingerprint IS NULL;

-- 2) Index d'unicité partiel (un seul brouillon "identique" par admin + client)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_draft_dedupe
  ON public.orders (created_by_admin, customer_id, draft_fingerprint)
  WHERE status = 'draft' AND draft_fingerprint IS NOT NULL;

-- 3) RPC : réutiliser un brouillon existant à contenu identique au lieu d'insérer
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

  IF _draft_id IS NOT NULL THEN
    UPDATE public.orders
       SET draft_payload = _payload,
           customer_id   = COALESCE(v_customer_id, customer_id),
           admin_notes   = v_admin_notes,
           payment_method = v_payment_method,
           payment_status = v_payment_status,
           updated_at    = now()
     WHERE id = _draft_id
       AND status = 'draft'
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'draft not found or not a draft';
    END IF;
    RETURN v_id;
  END IF;

  -- Création : exiger un customer_id (NOT NULL côté orders)
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id required to create a draft';
  END IF;

  -- Anti-doublon : si un brouillon strictement identique existe déjà
  -- pour ce même admin + client, on le réutilise (touch updated_at) au lieu d'insérer.
  SELECT id INTO v_id
    FROM public.orders
   WHERE status = 'draft'
     AND created_by_admin = v_uid
     AND customer_id = v_customer_id
     AND draft_fingerprint = v_fingerprint
   ORDER BY updated_at DESC
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.orders
       SET updated_at = now(),
           admin_notes = v_admin_notes,
           payment_method = v_payment_method,
           payment_status = v_payment_status
     WHERE id = v_id;
    RETURN v_id;
  END IF;

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

  RETURN v_id;
END
$function$;
