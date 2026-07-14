-- Point 1: mandate_signed_at on vendors (self-billing mandate reference date)
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS mandate_signed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendors.mandate_signed_at IS
  'Date de signature du mandat de facturation self-billing (Balooh SRL émet en nom et pour le compte du vendeur). Utilisé sur les factures Peppol.';

-- Point 3: Peppol retry counter
ALTER TABLE public.order_invoices
  ADD COLUMN IF NOT EXISTS peppol_retry_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.order_invoices.peppol_retry_count IS
  'Nombre de tentatives Peppol effectuées (max 3 via retry job).';

-- Helpful index for retry job scans
CREATE INDEX IF NOT EXISTS idx_order_invoices_peppol_retry
  ON public.order_invoices (peppol_status, peppol_last_attempt_at)
  WHERE peppol_status = 'failed';
