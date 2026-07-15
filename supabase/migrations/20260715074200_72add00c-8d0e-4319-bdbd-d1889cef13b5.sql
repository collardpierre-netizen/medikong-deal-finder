
-- 1) Nouvelles colonnes
ALTER TABLE public.order_invoices
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_channel text,
  ADD COLUMN IF NOT EXISTS sent_to text,
  ADD COLUMN IF NOT EXISTS sent_by uuid,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS payment_amount_received numeric(10,2),
  ADD COLUMN IF NOT EXISTS payment_method_received text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- Étendre les statuts autorisés (ajoute 'sent' et 'overdue')
ALTER TABLE public.order_invoices DROP CONSTRAINT IF EXISTS order_invoices_status_check;
ALTER TABLE public.order_invoices
  ADD CONSTRAINT order_invoices_status_check
  CHECK (status = ANY (ARRAY['pending','generated','sent','finalized','paid','overdue','failed']));

-- Contrainte sur le canal d'envoi
ALTER TABLE public.order_invoices DROP CONSTRAINT IF EXISTS order_invoices_sent_channel_check;
ALTER TABLE public.order_invoices
  ADD CONSTRAINT order_invoices_sent_channel_check
  CHECK (sent_channel IS NULL OR sent_channel = ANY (ARRAY['email','edi','peppol','postal','handover','other']));

-- Contrainte sur la méthode de paiement encaissée
ALTER TABLE public.order_invoices DROP CONSTRAINT IF EXISTS order_invoices_payment_method_received_check;
ALTER TABLE public.order_invoices
  ADD CONSTRAINT order_invoices_payment_method_received_check
  CHECK (payment_method_received IS NULL OR payment_method_received = ANY (ARRAY['bank_transfer','sepa','card','cash','stripe','other']));

-- 2) RPC : upsert facture manuelle (self_billing, saisie par admin ou vendeur propriétaire)
CREATE OR REPLACE FUNCTION public.upsert_manual_order_invoice(
  _order_id uuid,
  _vendor_id uuid,
  _invoice_number text,
  _issued_at timestamptz,
  _due_date date,
  _amount_excl_vat numeric,
  _vat_amount numeric,
  _amount_incl_vat numeric,
  _pdf_url text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_is_admin boolean;
  v_is_vendor boolean;
BEGIN
  v_is_admin := public.is_admin(auth.uid());
  v_is_vendor := EXISTS (
    SELECT 1 FROM public.vendors WHERE id = _vendor_id AND auth_user_id = auth.uid()
  );
  IF NOT (v_is_admin OR v_is_vendor) THEN
    RAISE EXCEPTION 'Not authorized to record invoice for this vendor';
  END IF;
  IF _invoice_number IS NULL OR btrim(_invoice_number) = '' THEN
    RAISE EXCEPTION 'invoice_number required';
  END IF;

  INSERT INTO public.order_invoices (
    order_id, vendor_id, type, invoice_number,
    amount_excl_vat, vat_amount, amount_incl_vat,
    issued_at, due_date, pdf_url, status, updated_at
  ) VALUES (
    _order_id, _vendor_id, 'self_billing', _invoice_number,
    COALESCE(_amount_excl_vat, 0), COALESCE(_vat_amount, 0), COALESCE(_amount_incl_vat, 0),
    COALESCE(_issued_at, now()), _due_date, _pdf_url, 'generated', now()
  )
  ON CONFLICT (order_id, vendor_id, type) DO UPDATE SET
    invoice_number  = EXCLUDED.invoice_number,
    amount_excl_vat = EXCLUDED.amount_excl_vat,
    vat_amount      = EXCLUDED.vat_amount,
    amount_incl_vat = EXCLUDED.amount_incl_vat,
    issued_at       = EXCLUDED.issued_at,
    due_date        = EXCLUDED.due_date,
    pdf_url         = COALESCE(EXCLUDED.pdf_url, public.order_invoices.pdf_url),
    status          = CASE WHEN public.order_invoices.status IN ('paid','sent') THEN public.order_invoices.status ELSE 'generated' END,
    updated_at      = now()
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_manual_order_invoice(uuid,uuid,text,timestamptz,date,numeric,numeric,numeric,text) TO authenticated;

-- 3) RPC : mise à jour statut facturation / paiement
CREATE OR REPLACE FUNCTION public.update_order_invoice_billing(
  _invoice_id uuid,
  _patch jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id uuid;
  v_is_admin boolean;
  v_is_vendor boolean;
BEGIN
  SELECT vendor_id INTO v_vendor_id FROM public.order_invoices WHERE id = _invoice_id;
  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  v_is_admin := public.is_admin(auth.uid());
  v_is_vendor := EXISTS (
    SELECT 1 FROM public.vendors WHERE id = v_vendor_id AND auth_user_id = auth.uid()
  );
  IF NOT (v_is_admin OR v_is_vendor) THEN
    RAISE EXCEPTION 'Not authorized to update this invoice';
  END IF;

  UPDATE public.order_invoices SET
    status                    = COALESCE(_patch->>'status', status),
    sent_at                   = CASE WHEN _patch ? 'sent_at' THEN NULLIF(_patch->>'sent_at','')::timestamptz ELSE sent_at END,
    sent_channel              = CASE WHEN _patch ? 'sent_channel' THEN NULLIF(_patch->>'sent_channel','') ELSE sent_channel END,
    sent_to                   = CASE WHEN _patch ? 'sent_to' THEN NULLIF(_patch->>'sent_to','') ELSE sent_to END,
    sent_by                   = CASE WHEN _patch ? 'sent_at' AND sent_by IS NULL AND _patch->>'sent_at' IS NOT NULL THEN auth.uid() ELSE sent_by END,
    due_date                  = CASE WHEN _patch ? 'due_date' THEN NULLIF(_patch->>'due_date','')::date ELSE due_date END,
    paid_at                   = CASE WHEN _patch ? 'paid_at' THEN NULLIF(_patch->>'paid_at','')::timestamptz ELSE paid_at END,
    payment_amount_received   = CASE WHEN _patch ? 'payment_amount_received' THEN NULLIF(_patch->>'payment_amount_received','')::numeric ELSE payment_amount_received END,
    payment_method_received   = CASE WHEN _patch ? 'payment_method_received' THEN NULLIF(_patch->>'payment_method_received','') ELSE payment_method_received END,
    payment_reference         = CASE WHEN _patch ? 'payment_reference' THEN NULLIF(_patch->>'payment_reference','') ELSE payment_reference END,
    last_reminder_at          = CASE WHEN _patch ? 'last_reminder_at' THEN NULLIF(_patch->>'last_reminder_at','')::timestamptz ELSE last_reminder_at END,
    reminder_count            = CASE WHEN (_patch->>'increment_reminder')::boolean IS TRUE THEN reminder_count + 1 ELSE reminder_count END,
    internal_notes            = CASE WHEN _patch ? 'internal_notes' THEN NULLIF(_patch->>'internal_notes','') ELSE internal_notes END,
    updated_at                = now()
  WHERE id = _invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_order_invoice_billing(uuid, jsonb) TO authenticated;

-- 4) Index pratique pour la vue "en retard"
CREATE INDEX IF NOT EXISTS idx_order_invoices_due_date
  ON public.order_invoices (due_date)
  WHERE status <> 'paid' AND due_date IS NOT NULL;
