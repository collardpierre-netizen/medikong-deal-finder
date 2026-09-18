-- LOT 0027 — Motifs codifiés (paiement partiel / blocage / annulation BL) + historique mensuel des déblocages
-- Aucune donnée existante modifiée : colonnes nullables, anciennes décisions conservées.

-- 1) Colonnes de motif codifié
ALTER TABLE public.delivery_payment_releases
  ADD COLUMN IF NOT EXISTS reason_code text;

ALTER TABLE public.delivery_notes
  ADD COLUMN IF NOT EXISTS cancellation_reason_code text;

ALTER TABLE public.delivery_payment_releases
  DROP CONSTRAINT IF EXISTS delivery_payment_releases_reason_code_check;
ALTER TABLE public.delivery_payment_releases
  ADD CONSTRAINT delivery_payment_releases_reason_code_check
  CHECK (reason_code IS NULL OR reason_code IN (
    'partial_delivery',          -- livraison partielle
    'refused_items',             -- articles refusés par le client
    'damaged_goods',             -- marchandise abîmée
    'wrong_items',               -- erreur de référence
    'missing_documents',         -- documents/lot manquants
    'client_dispute',            -- litige client en cours
    'pending_credit_note',       -- note de crédit fournisseur attendue
    'awaiting_signature',        -- checklist non signée
    'compliance_check',          -- contrôle conformité en cours
    'other'
  ));

ALTER TABLE public.delivery_notes
  DROP CONSTRAINT IF EXISTS delivery_notes_cancellation_reason_code_check;
ALTER TABLE public.delivery_notes
  ADD CONSTRAINT delivery_notes_cancellation_reason_code_check
  CHECK (cancellation_reason_code IS NULL OR cancellation_reason_code IN (
    'encoding_error',            -- erreur d'encodage
    'wrong_quantities',          -- quantités erronées
    'wrong_recipient',           -- destinataire erroné
    'shipment_not_departed',     -- expédition non partie
    'client_cancellation',       -- annulation à la demande du client
    'lost_in_transit',           -- colis perdu
    'replaced_by_new_note',      -- remplacé par un nouveau BL
    'other'
  ));

-- 2) set_delivery_payment_release : ajout du motif codifié, obligatoire pour partial/blocked
DROP FUNCTION IF EXISTS public.set_delivery_payment_release(uuid, text, integer, text);

CREATE OR REPLACE FUNCTION public.set_delivery_payment_release(
  _delivery_note_id uuid,
  _decision text,
  _authorized_amount_ht_cents integer DEFAULT 0,
  _reason text DEFAULT NULL,
  _reason_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_note record;
  v_id uuid;
  v_code text := NULLIF(btrim(COALESCE(_reason_code, '')), '');
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _decision NOT IN ('full', 'partial', 'blocked') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF _decision = 'blocked' AND COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _decision IN ('partial', 'blocked') AND v_code IS NULL THEN RAISE EXCEPTION 'reason_code_required'; END IF;

  SELECT * INTO v_note FROM public.delivery_notes WHERE id = _delivery_note_id;
  IF v_note.id IS NULL THEN RAISE EXCEPTION 'delivery_note_not_found'; END IF;

  INSERT INTO public.delivery_payment_releases (
    delivery_note_id, vendor_id, decision, authorized_amount_ht_cents, reason, reason_code, decided_by
  ) VALUES (
    _delivery_note_id, v_note.vendor_id, _decision,
    CASE WHEN _decision = 'blocked' THEN 0 ELSE GREATEST(0, COALESCE(_authorized_amount_ht_cents, 0)) END,
    NULLIF(btrim(COALESCE(_reason, '')), ''),
    v_code,
    auth.uid()
  )
  ON CONFLICT (delivery_note_id) DO UPDATE
    SET decision = EXCLUDED.decision,
        vendor_id = EXCLUDED.vendor_id,
        authorized_amount_ht_cents = EXCLUDED.authorized_amount_ht_cents,
        reason = EXCLUDED.reason,
        reason_code = EXCLUDED.reason_code,
        decided_by = EXCLUDED.decided_by,
        decided_at = now(),
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_delivery_payment_release(uuid, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_delivery_payment_release(uuid, text, integer, text, text) TO authenticated, service_role;

-- 3) cancel_delivery_note : motif codifié obligatoire
DROP FUNCTION IF EXISTS public.cancel_delivery_note(uuid, text);

CREATE OR REPLACE FUNCTION public.cancel_delivery_note(
  _delivery_note_id uuid,
  _reason text DEFAULT NULL,
  _reason_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dn record;
  v_code text := NULLIF(btrim(COALESCE(_reason_code, '')), '');
BEGIN
  SELECT * INTO v_dn FROM public.delivery_notes WHERE id = _delivery_note_id;
  IF v_dn.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.is_admin() AND (v_dn.vendor_id IS NULL OR v_dn.vendor_id IS DISTINCT FROM public.current_vendor_id()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF v_dn.status = 'cancelled' THEN RETURN; END IF;
  IF v_code IS NULL THEN RAISE EXCEPTION 'reason_code_required'; END IF;

  UPDATE public.delivery_notes
     SET status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = NULLIF(btrim(COALESCE(_reason, '')), ''),
         cancellation_reason_code = v_code
   WHERE id = _delivery_note_id;

  UPDATE public.order_lines ol
     SET quantity_shipped = COALESCE((
           SELECT SUM(dnl.quantity)::int
           FROM public.delivery_note_lines dnl
           JOIN public.delivery_notes dn ON dn.id = dnl.delivery_note_id
           WHERE dnl.order_line_id = ol.id AND dn.status = 'issued'
         ), 0),
         updated_at = now()
   WHERE ol.id IN (SELECT order_line_id FROM public.delivery_note_lines WHERE delivery_note_id = _delivery_note_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_delivery_note(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_delivery_note(uuid, text, text) TO authenticated, service_role;

-- 4) Historique mensuel des déblocages (admin uniquement)
CREATE OR REPLACE FUNCTION public.admin_delivery_release_months(_months integer DEFAULT 12)
RETURNS TABLE (
  month date,
  releases_count integer,
  full_count integer,
  partial_count integer,
  blocked_count integer,
  authorized_ht_cents bigint,
  partial_ht_cents bigint,
  blocked_notes_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT date_trunc('month', r.decided_at)::date AS month,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE r.decision = 'full')::int,
         COUNT(*) FILTER (WHERE r.decision = 'partial')::int,
         COUNT(*) FILTER (WHERE r.decision = 'blocked')::int,
         COALESCE(SUM(r.authorized_amount_ht_cents), 0)::bigint,
         COALESCE(SUM(r.authorized_amount_ht_cents) FILTER (WHERE r.decision = 'partial'), 0)::bigint,
         COUNT(DISTINCT r.delivery_note_id) FILTER (WHERE r.decision = 'blocked')::int
  FROM public.delivery_payment_releases r
  WHERE public.is_admin()
    AND r.decided_at >= date_trunc('month', now()) - (GREATEST(1, COALESCE(_months, 12)) - 1) * INTERVAL '1 month'
  GROUP BY 1
  ORDER BY 1 DESC;
$function$;

REVOKE ALL ON FUNCTION public.admin_delivery_release_months(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delivery_release_months(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_delivery_release_month_detail(_month date)
RETURNS TABLE (
  release_id uuid,
  delivery_note_id uuid,
  document_number text,
  order_id uuid,
  order_number text,
  vendor_label text,
  decision text,
  reason_code text,
  reason text,
  authorized_ht_cents integer,
  decided_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT r.id, r.delivery_note_id, dn.document_number, dn.order_id, o.order_number,
         COALESCE(v.display_code, '—') AS vendor_label,
         r.decision, r.reason_code, r.reason, r.authorized_amount_ht_cents, r.decided_at
  FROM public.delivery_payment_releases r
  JOIN public.delivery_notes dn ON dn.id = r.delivery_note_id
  LEFT JOIN public.orders o ON o.id = dn.order_id
  LEFT JOIN public.vendors v ON v.id = r.vendor_id
  WHERE public.is_admin()
    AND r.decided_at >= _month
    AND r.decided_at < (_month + INTERVAL '1 month')
  ORDER BY r.decided_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.admin_delivery_release_month_detail(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delivery_release_month_detail(date) TO authenticated, service_role;
