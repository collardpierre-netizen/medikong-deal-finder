
ALTER TABLE public.order_invoices
  ADD COLUMN IF NOT EXISTS peppol_status text,
  ADD COLUMN IF NOT EXISTS peppol_document_id text,
  ADD COLUMN IF NOT EXISTS peppol_identifier text,
  ADD COLUMN IF NOT EXISTS peppol_error text,
  ADD COLUMN IF NOT EXISTS peppol_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS peppol_last_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS order_invoices_peppol_status_idx
  ON public.order_invoices(peppol_status)
  WHERE peppol_status IS NOT NULL;
