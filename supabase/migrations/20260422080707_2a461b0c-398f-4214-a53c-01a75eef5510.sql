-- Table d'archive des conventions signées
CREATE TABLE IF NOT EXISTS public.seller_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  contract_type text NOT NULL DEFAULT 'mandat_facturation',
  contract_version text NOT NULL DEFAULT 'v1.0',
  signed_at timestamptz NOT NULL DEFAULT now(),
  signature_data text NOT NULL,
  signature_method text NOT NULL CHECK (signature_method IN ('canvas', 'typed_name')),
  signer_name text NOT NULL,
  signer_role text,
  pdf_url text,
  pdf_storage_path text,
  document_hash text,
  ip_address inet,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_contracts_vendor_id ON public.seller_contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_seller_contracts_type_version ON public.seller_contracts(contract_type, contract_version);
CREATE INDEX IF NOT EXISTS idx_seller_contracts_signed_at ON public.seller_contracts(signed_at DESC);

-- RLS
ALTER TABLE public.seller_contracts ENABLE ROW LEVEL SECURITY;

-- Vendeur peut lire ses propres contrats
CREATE POLICY "Vendors can read own contracts"
  ON public.seller_contracts
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()
    )
  );

-- Vendeur peut insérer son propre contrat
CREATE POLICY "Vendors can insert own contracts"
  ON public.seller_contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()
    )
  );

-- Admins peuvent tout lire
CREATE POLICY "Admins can read all contracts"
  ON public.seller_contracts
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Bucket privé pour PDFs de contrats
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-contracts', 'seller-contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies : un vendeur lit/uploade dans son propre dossier (vendor_id en racine)
CREATE POLICY "Vendors upload own contract PDFs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'seller-contracts'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.vendors WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors read own contract PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'seller-contracts'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.vendors WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins read all contract PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'seller-contracts'
    AND public.is_admin(auth.uid())
  );