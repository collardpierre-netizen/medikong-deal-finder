ALTER TABLE public.order_invoices
  ADD COLUMN IF NOT EXISTS credit_note_peppol_id text,
  ADD COLUMN IF NOT EXISTS credited_at timestamptz;

-- Extend peppol_status vocabulary: 'credited' means a credit note has been emitted
-- and delivered to Falco for the original invoice.
COMMENT ON COLUMN public.order_invoices.credit_note_peppol_id IS
  'Falco document_id of the credit note that cancels this invoice (via /invoices/imports/pdf).';
COMMENT ON COLUMN public.order_invoices.credited_at IS
  'Timestamp when the credit note was successfully accepted by Falco.';