
ALTER TABLE public.commission_invoices
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS peppol_status text,
  ADD COLUMN IF NOT EXISTS peppol_document_id text,
  ADD COLUMN IF NOT EXISTS peppol_error text,
  ADD COLUMN IF NOT EXISTS peppol_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS peppol_retry_count integer NOT NULL DEFAULT 0;
