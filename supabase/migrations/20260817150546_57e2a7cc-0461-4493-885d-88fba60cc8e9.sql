-- ============ 3.1 customers : facturation électronique ============
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS peppol_id text,
  ADD COLUMN IF NOT EXISTS peppol_scheme text,
  ADD COLUMN IF NOT EXISTS peppol_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS peppol_directory_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS peppol_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS einvoicing_channel text DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS einvoicing_email text;

DO $$ BEGIN
  ALTER TABLE public.customers
    ADD CONSTRAINT customers_peppol_directory_status_check
    CHECK (peppol_directory_status IN ('unknown','found','not_found','error'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.customers
    ADD CONSTRAINT customers_einvoicing_channel_check
    CHECK (einvoicing_channel IN ('peppol','email','both'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.customers
    ADD CONSTRAINT customers_peppol_id_format
    CHECK (peppol_id IS NULL OR peppol_id ~ '^[0-9]{4}:[A-Za-z0-9]{4,50}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_customers_peppol_id
  ON public.customers(peppol_id) WHERE peppol_id IS NOT NULL;

-- Cohérence canal / identifiant : rétrograder silencieusement
CREATE OR REPLACE FUNCTION public._customers_einvoicing_coherence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.peppol_id IS NULL AND NEW.einvoicing_channel IN ('peppol','both') THEN
    NEW.einvoicing_channel := 'email';
  END IF;
  IF NEW.peppol_id IS NOT NULL THEN
    NEW.peppol_scheme := split_part(NEW.peppol_id, ':', 1);
  ELSE
    NEW.peppol_scheme := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_einvoicing_coherence ON public.customers;
CREATE TRIGGER trg_customers_einvoicing_coherence
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public._customers_einvoicing_coherence();

-- ============ 3.2 peppol_transmissions ============
CREATE TABLE IF NOT EXISTS public.peppol_transmissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  document_type text NOT NULL
    CHECK (document_type IN ('order_invoice','commission_invoice','credit_note')),
  order_invoice_id uuid REFERENCES public.order_invoices(id) ON DELETE CASCADE,
  commission_invoice_id uuid REFERENCES public.commission_invoices(id) ON DELETE CASCADE,
  credit_note_id uuid REFERENCES public.peppol_credit_notes(id) ON DELETE CASCADE,

  flow text NOT NULL CHECK (flow IN ('vendor_copy','buyer_invoice','commission')),

  sender_kind text CHECK (sender_kind IN ('medikong','vendor')),
  sender_name_snapshot text,
  sender_vat_snapshot text,

  receiver_kind text NOT NULL CHECK (receiver_kind IN ('vendor','customer')),
  receiver_id uuid NOT NULL,
  receiver_peppol_id text,
  receiver_name_snapshot text,
  receiver_vat_snapshot text,

  channel text NOT NULL CHECK (channel IN ('peppol','email')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','delivered','failed','skipped','cancelled')),

  peppol_document_id text,
  falco_import_id text,

  payload_storage_path text,
  payload_sha256 text,
  pdf_storage_path text,
  pdf_sha256 text,
  ubl_storage_path text,
  ubl_sha256 text,

  retry_count int NOT NULL DEFAULT 0,
  last_error text,
  submitted_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT peppol_transmissions_one_source CHECK (
    (order_invoice_id IS NOT NULL)::int
  + (commission_invoice_id IS NOT NULL)::int
  + (credit_note_id IS NOT NULL)::int = 1
  )
);

GRANT SELECT ON public.peppol_transmissions TO authenticated;
GRANT ALL ON public.peppol_transmissions TO service_role;

ALTER TABLE public.peppol_transmissions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_peppol_tx_order_invoice_flow
  ON public.peppol_transmissions(order_invoice_id, flow, channel)
  WHERE order_invoice_id IS NOT NULL AND status <> 'cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS uq_peppol_tx_document_id
  ON public.peppol_transmissions(peppol_document_id)
  WHERE peppol_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_peppol_tx_status
  ON public.peppol_transmissions(status)
  WHERE status IN ('pending','sending','failed');

CREATE INDEX IF NOT EXISTS idx_peppol_tx_order_invoice
  ON public.peppol_transmissions(order_invoice_id);

DROP TRIGGER IF EXISTS trg_peppol_transmissions_updated_at ON public.peppol_transmissions;
CREATE TRIGGER trg_peppol_transmissions_updated_at
  BEFORE UPDATE ON public.peppol_transmissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
DROP POLICY IF EXISTS "peppol_tx_admin_read" ON public.peppol_transmissions;
CREATE POLICY "peppol_tx_admin_read" ON public.peppol_transmissions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "peppol_tx_vendor_read" ON public.peppol_transmissions;
CREATE POLICY "peppol_tx_vendor_read" ON public.peppol_transmissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_invoices oi
      JOIN public.vendors v ON v.id = oi.vendor_id
      WHERE oi.id = peppol_transmissions.order_invoice_id
        AND v.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.commission_invoices ci
      JOIN public.vendors v ON v.id = ci.vendor_id
      WHERE ci.id = peppol_transmissions.commission_invoice_id
        AND v.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "peppol_tx_buyer_read" ON public.peppol_transmissions;
CREATE POLICY "peppol_tx_buyer_read" ON public.peppol_transmissions
  FOR SELECT TO authenticated
  USING (
    flow = 'buyer_invoice'
    AND EXISTS (
      SELECT 1
      FROM public.order_invoices oi
      JOIN public.orders o ON o.id = oi.order_id
      JOIN public.customers c ON c.id = o.customer_id
      WHERE oi.id = peppol_transmissions.order_invoice_id
        AND c.auth_user_id = auth.uid()
    )
  );
