-- 1. Colonnes de confirmation client sur les bons de livraison
ALTER TABLE public.delivery_notes
  ADD COLUMN IF NOT EXISTS confirmation_token text,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by_name text,
  ADD COLUMN IF NOT EXISTS signature_storage_path text,
  ADD COLUMN IF NOT EXISTS client_remarks text,
  ADD COLUMN IF NOT EXISTS confirmation_ip text,
  ADD COLUMN IF NOT EXISTS checklist jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS delivery_notes_confirmation_token_key
  ON public.delivery_notes (confirmation_token) WHERE confirmation_token IS NOT NULL;

ALTER TABLE public.delivery_note_lines
  ADD COLUMN IF NOT EXISTS accepted_quantity integer,
  ADD COLUMN IF NOT EXISTS refused_quantity integer,
  ADD COLUMN IF NOT EXISTS refusal_reason text;

-- 2. Déblocage du paiement fournisseur
CREATE TABLE IF NOT EXISTS public.delivery_payment_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id uuid NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  decision text NOT NULL,
  authorized_amount_ht_cents integer NOT NULL DEFAULT 0,
  reason text,
  decided_by uuid,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_payment_releases_note_key
  ON public.delivery_payment_releases (delivery_note_id);

GRANT SELECT ON public.delivery_payment_releases TO authenticated;
GRANT ALL ON public.delivery_payment_releases TO service_role;

ALTER TABLE public.delivery_payment_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dpr_admin_all ON public.delivery_payment_releases;
CREATE POLICY dpr_admin_all ON public.delivery_payment_releases
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS dpr_vendor_select ON public.delivery_payment_releases;
CREATE POLICY dpr_vendor_select ON public.delivery_payment_releases
  FOR SELECT TO authenticated
  USING (vendor_id IS NOT NULL AND vendor_id = public.current_vendor_id());

-- 3. Génération du jeton de confirmation (admin ou fournisseur propriétaire)
CREATE OR REPLACE FUNCTION public.create_delivery_note_confirmation_token(_delivery_note_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean := public.is_admin();
  v_vendor uuid := public.current_vendor_id();
  v_note record;
  v_token text;
BEGIN
  SELECT * INTO v_note FROM public.delivery_notes WHERE id = _delivery_note_id;
  IF v_note.id IS NULL THEN RAISE EXCEPTION 'delivery_note_not_found'; END IF;
  IF NOT v_is_admin AND (v_vendor IS NULL OR v_note.vendor_id IS DISTINCT FROM v_vendor) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF v_note.status <> 'issued' THEN RAISE EXCEPTION 'delivery_note_cancelled'; END IF;
  IF v_note.confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'already_confirmed'; END IF;

  v_token := COALESCE(v_note.confirmation_token, encode(gen_random_bytes(24), 'hex'));

  UPDATE public.delivery_notes
     SET confirmation_token = v_token,
         confirmation_sent_at = now(),
         updated_at = now()
   WHERE id = _delivery_note_id;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_delivery_note_confirmation_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_delivery_note_confirmation_token(uuid) TO authenticated, service_role;

-- 4. Lecture publique par jeton
CREATE OR REPLACE FUNCTION public.delivery_note_public_get(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_note record;
  v_order record;
  v_lines jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT * INTO v_note FROM public.delivery_notes WHERE confirmation_token = _token;
  IF v_note.id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF v_note.status <> 'issued' THEN RETURN jsonb_build_object('error', 'cancelled'); END IF;

  SELECT o.id, o.order_number, o.shipping_address INTO v_order
  FROM public.orders o WHERE o.id = v_note.order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'delivery_note_line_id', dnl.id,
           'product_name', COALESCE(ol.manual_label, p.name, 'Produit'),
           'cnk_code', p.cnk_code,
           'gtin', p.gtin,
           'delivered_quantity', dnl.quantity,
           'accepted_quantity', dnl.accepted_quantity,
           'refused_quantity', dnl.refused_quantity,
           'refusal_reason', dnl.refusal_reason
         ) ORDER BY dnl.created_at), '[]'::jsonb)
    INTO v_lines
  FROM public.delivery_note_lines dnl
  JOIN public.order_lines ol ON ol.id = dnl.order_line_id
  LEFT JOIN public.products p ON p.id = ol.product_id
  WHERE dnl.delivery_note_id = v_note.id;

  RETURN jsonb_build_object(
    'delivery_note_id', v_note.id,
    'document_number', v_note.document_number,
    'issued_at', v_note.issued_at,
    'carrier', v_note.carrier,
    'tracking_number', v_note.tracking_number,
    'note', v_note.note,
    'order_number', v_order.order_number,
    'shipping_address', COALESCE(v_note.shipping_address, v_order.shipping_address),
    'confirmed_at', v_note.confirmed_at,
    'confirmed_by_name', v_note.confirmed_by_name,
    'client_remarks', v_note.client_remarks,
    'checklist', v_note.checklist,
    'lines', v_lines
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_note_public_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_note_public_get(text) TO anon, authenticated, service_role;

-- 5. Confirmation (appelée par l'edge function avec la clé de service)
CREATE OR REPLACE FUNCTION public.delivery_note_confirm_by_token(
  _token text,
  _confirmed_by_name text,
  _checklist jsonb,
  _lines jsonb,
  _remarks text DEFAULT NULL,
  _signature_storage_path text DEFAULT NULL,
  _ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_note record;
  v_item jsonb;
  v_line record;
  v_accepted int;
BEGIN
  SELECT * INTO v_note FROM public.delivery_notes WHERE confirmation_token = _token FOR UPDATE;
  IF v_note.id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF v_note.status <> 'issued' THEN RETURN jsonb_build_object('error', 'cancelled'); END IF;
  IF v_note.confirmed_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'already_confirmed'); END IF;
  IF COALESCE(btrim(_confirmed_by_name), '') = '' THEN RETURN jsonb_build_object('error', 'name_required'); END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(_lines, '[]'::jsonb))
  LOOP
    SELECT * INTO v_line FROM public.delivery_note_lines
     WHERE id = (v_item->>'delivery_note_line_id')::uuid AND delivery_note_id = v_note.id;
    IF v_line.id IS NULL THEN CONTINUE; END IF;

    v_accepted := GREATEST(0, LEAST(COALESCE((v_item->>'accepted_quantity')::int, v_line.quantity), v_line.quantity));

    UPDATE public.delivery_note_lines
       SET accepted_quantity = v_accepted,
           refused_quantity = v_line.quantity - v_accepted,
           refusal_reason = NULLIF(btrim(COALESCE(v_item->>'refusal_reason', '')), '')
     WHERE id = v_line.id;
  END LOOP;

  UPDATE public.delivery_notes
     SET confirmed_at = now(),
         confirmed_by_name = btrim(_confirmed_by_name),
         checklist = _checklist,
         client_remarks = NULLIF(btrim(COALESCE(_remarks, '')), ''),
         signature_storage_path = _signature_storage_path,
         confirmation_ip = _ip,
         updated_at = now()
   WHERE id = v_note.id;

  RETURN jsonb_build_object('success', true, 'delivery_note_id', v_note.id, 'confirmed_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_note_confirm_by_token(text, text, jsonb, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_note_confirm_by_token(text, text, jsonb, jsonb, text, text, text) TO service_role;

-- 6. Décision de déblocage du paiement fournisseur (admin)
CREATE OR REPLACE FUNCTION public.set_delivery_payment_release(
  _delivery_note_id uuid,
  _decision text,
  _authorized_amount_ht_cents integer DEFAULT 0,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_note record;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _decision NOT IN ('full', 'partial', 'blocked') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF _decision = 'blocked' AND COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO v_note FROM public.delivery_notes WHERE id = _delivery_note_id;
  IF v_note.id IS NULL THEN RAISE EXCEPTION 'delivery_note_not_found'; END IF;

  INSERT INTO public.delivery_payment_releases (
    delivery_note_id, vendor_id, decision, authorized_amount_ht_cents, reason, decided_by
  ) VALUES (
    _delivery_note_id, v_note.vendor_id, _decision,
    CASE WHEN _decision = 'blocked' THEN 0 ELSE GREATEST(0, COALESCE(_authorized_amount_ht_cents, 0)) END,
    NULLIF(btrim(COALESCE(_reason, '')), ''), auth.uid()
  )
  ON CONFLICT (delivery_note_id) DO UPDATE
    SET decision = EXCLUDED.decision,
        vendor_id = EXCLUDED.vendor_id,
        authorized_amount_ht_cents = EXCLUDED.authorized_amount_ht_cents,
        reason = EXCLUDED.reason,
        decided_by = EXCLUDED.decided_by,
        decided_at = now(),
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_delivery_payment_release(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_delivery_payment_release(uuid, text, integer, text) TO authenticated, service_role;