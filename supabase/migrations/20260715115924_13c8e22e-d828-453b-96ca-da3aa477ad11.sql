-- Table vendor_statements
CREATE TABLE IF NOT EXISTS public.vendor_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  total_gross_ttc NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_commission_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_commission_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_net_transferred NUMERIC(12,2) NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  pdf_path TEXT,
  pdf_url TEXT,
  peppol_status TEXT NOT NULL DEFAULT 'not_applicable',
  email_sent_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, period_year, period_month)
);

GRANT SELECT ON public.vendor_statements TO authenticated;
GRANT ALL ON public.vendor_statements TO service_role;

ALTER TABLE public.vendor_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage vendor_statements"
  ON public.vendor_statements
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Vendor sees own statements"
  ON public.vendor_statements
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages vendor_statements"
  ON public.vendor_statements
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_vendor_statements_vendor ON public.vendor_statements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_statements_period ON public.vendor_statements(period_year DESC, period_month DESC);

CREATE OR REPLACE FUNCTION public.tg_vendor_statements_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_statements_updated_at ON public.vendor_statements;
CREATE TRIGGER trg_vendor_statements_updated_at
  BEFORE UPDATE ON public.vendor_statements
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendor_statements_updated_at();

-- Storage policies (bucket 'vendor-statements' déjà créé)
DROP POLICY IF EXISTS "Admins manage vendor-statements bucket" ON storage.objects;
CREATE POLICY "Admins manage vendor-statements bucket"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'vendor-statements' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'vendor-statements' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Vendor reads own statement PDFs" ON storage.objects;
CREATE POLICY "Vendor reads own statement PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'vendor-statements'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.vendors WHERE auth_user_id = auth.uid()
    )
  );