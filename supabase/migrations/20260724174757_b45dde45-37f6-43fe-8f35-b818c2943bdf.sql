ALTER TABLE public.peppol_credit_notes
  ADD COLUMN IF NOT EXISTS credited_document_type text
    CHECK (credited_document_type IS NULL OR credited_document_type IN ('order_invoice', 'commission_invoice'));

UPDATE public.peppol_credit_notes
SET credited_document_type = 'order_invoice'
WHERE invoice_id IS NOT NULL AND credited_document_type IS NULL;

ALTER TABLE public.peppol_credit_notes
  ADD COLUMN IF NOT EXISTS commission_invoice_id uuid REFERENCES public.commission_invoices(id);

ALTER TABLE public.peppol_credit_notes
  DROP CONSTRAINT IF EXISTS peppol_credit_notes_credited_document_xor;

ALTER TABLE public.peppol_credit_notes
  ADD CONSTRAINT peppol_credit_notes_credited_document_xor CHECK (
    (credited_document_type = 'order_invoice'      AND invoice_id IS NOT NULL AND commission_invoice_id IS NULL)
    OR
    (credited_document_type = 'commission_invoice' AND commission_invoice_id IS NOT NULL AND invoice_id IS NULL)
    OR
    (credited_document_type IS NULL AND invoice_id IS NULL AND commission_invoice_id IS NULL)
  );