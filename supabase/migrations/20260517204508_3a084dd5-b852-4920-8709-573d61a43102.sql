CREATE TABLE IF NOT EXISTS public.audit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_name text NOT NULL,
  pharmacy_apb_number text,
  pharmacy_address text,
  pharmacy_city text,
  pharmacy_postal_code text,
  pharmacy_country text DEFAULT 'BE',
  contact_first_name text NOT NULL,
  contact_last_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  pdf_storage_paths jsonb DEFAULT '[]'::jsonb,
  additional_notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'sent', 'declined')),
  admin_notes text,
  report_pdf_url text,
  economies_estimated_min numeric,
  economies_estimated_max numeric,
  sent_at timestamptz,
  consented_at timestamptz NOT NULL DEFAULT now(),
  consent_text_version text DEFAULT 'v1-2026-05',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_requests_status ON public.audit_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_requests_email ON public.audit_requests(contact_email);
CREATE INDEX IF NOT EXISTS idx_audit_requests_created ON public.audit_requests(created_at DESC);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_audit_requests_set_updated_at ON public.audit_requests;
CREATE TRIGGER trg_audit_requests_set_updated_at
  BEFORE UPDATE ON public.audit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket privé pour les factures
INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-pdfs', 'audit-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.audit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin only access" ON public.audit_requests;
CREATE POLICY "Admin only access" ON public.audit_requests
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');