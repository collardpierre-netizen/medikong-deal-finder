
-- 1) Colonne pour stocker le payload brut du brouillon
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS draft_payload jsonb;

-- 2) Sauvegarde / upsert d'un brouillon admin
CREATE OR REPLACE FUNCTION public.admin_save_manual_order_draft(
  _draft_id uuid,
  _payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_customer_id uuid;
  v_admin_notes text;
  v_payment_method payment_method_enum;
  v_payment_status payment_status_enum;
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
  ELSE
    -- pour la création on a besoin a minima d'un customer_id (NOT NULL sur orders)
    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'customer_id required to create a draft';
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
  END IF;

  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.admin_save_manual_order_draft(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_manual_order_draft(uuid, jsonb) TO authenticated;

-- 3) Charge un brouillon
CREATE OR REPLACE FUNCTION public.admin_load_manual_order_draft(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payload jsonb;
BEGIN
  IF NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  SELECT draft_payload INTO v_payload
    FROM public.orders
   WHERE id = _id AND status = 'draft';
  IF v_payload IS NULL THEN
    RAISE EXCEPTION 'draft not found';
  END IF;
  RETURN v_payload;
END
$$;
REVOKE ALL ON FUNCTION public.admin_load_manual_order_draft(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_load_manual_order_draft(uuid) TO authenticated;

-- 4) Liste des brouillons (partagée entre admins)
CREATE OR REPLACE FUNCTION public.admin_list_manual_order_drafts()
RETURNS TABLE (
  id uuid,
  order_number text,
  customer_id uuid,
  customer_label text,
  admin_notes text,
  created_by_admin uuid,
  created_at timestamptz,
  updated_at timestamptz,
  line_count int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  RETURN QUERY
    SELECT o.id,
           o.order_number,
           o.customer_id,
           COALESCE(c.company_name, c.email, o.customer_id::text) AS customer_label,
           o.admin_notes,
           o.created_by_admin,
           o.created_at,
           o.updated_at,
           COALESCE(jsonb_array_length(o.draft_payload->'lines'), 0) AS line_count
      FROM public.orders o
      LEFT JOIN public.customers c ON c.id = o.customer_id
     WHERE o.status = 'draft'
     ORDER BY o.updated_at DESC
     LIMIT 100;
END
$$;
REVOKE ALL ON FUNCTION public.admin_list_manual_order_drafts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_manual_order_drafts() TO authenticated;

-- 5) Suppression
CREATE OR REPLACE FUNCTION public.admin_delete_manual_order_draft(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  DELETE FROM public.orders WHERE id = _id AND status = 'draft';
END
$$;
REVOKE ALL ON FUNCTION public.admin_delete_manual_order_draft(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_manual_order_draft(uuid) TO authenticated;
