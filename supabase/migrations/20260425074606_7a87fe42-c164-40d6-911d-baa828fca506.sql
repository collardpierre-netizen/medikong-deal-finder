-- Table principale des délégués vendeurs
CREATE TABLE IF NOT EXISTS public.vendor_delegates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  job_title TEXT,
  email TEXT,
  phone TEXT,
  booking_url TEXT,
  photo_url TEXT,
  bio TEXT,
  languages TEXT[] NOT NULL DEFAULT '{}',
  country_codes TEXT[] NOT NULL DEFAULT '{}',
  regions TEXT[] NOT NULL DEFAULT '{}',
  target_profiles TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_delegates_vendor ON public.vendor_delegates(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_delegates_active ON public.vendor_delegates(vendor_id, is_active);
CREATE INDEX IF NOT EXISTS idx_vendor_delegates_countries ON public.vendor_delegates USING GIN(country_codes);
CREATE INDEX IF NOT EXISTS idx_vendor_delegates_profiles ON public.vendor_delegates USING GIN(target_profiles);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_vendor_delegates_updated_at ON public.vendor_delegates;
CREATE TRIGGER trg_vendor_delegates_updated_at
  BEFORE UPDATE ON public.vendor_delegates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.vendor_delegates ENABLE ROW LEVEL SECURITY;

-- Vendeur propriétaire : ALL sur ses propres délégués
DROP POLICY IF EXISTS "Vendor owner manages own delegates" ON public.vendor_delegates;
CREATE POLICY "Vendor owner manages own delegates"
  ON public.vendor_delegates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_delegates.vendor_id
        AND v.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_delegates.vendor_id
        AND v.auth_user_id = auth.uid()
    )
  );

-- Admins : ALL
DROP POLICY IF EXISTS "Admins manage all delegates" ON public.vendor_delegates;
CREATE POLICY "Admins manage all delegates"
  ON public.vendor_delegates FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Acheteurs vérifiés : SELECT sur délégués actifs uniquement
DROP POLICY IF EXISTS "Verified buyers read active delegates" ON public.vendor_delegates;
CREATE POLICY "Verified buyers read active delegates"
  ON public.vendor_delegates FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.auth_user_id = auth.uid()
        AND c.is_verified = true
    )
  );

-- Bucket photos des délégués
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-delegates', 'vendor-delegates', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique
DROP POLICY IF EXISTS "Vendor delegates public read" ON storage.objects;
CREATE POLICY "Vendor delegates public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-delegates');

-- Upload: vendeur dans son dossier OU admin
DROP POLICY IF EXISTS "Vendor delegates owner upload" ON storage.objects;
CREATE POLICY "Vendor delegates owner upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-delegates'
    AND (
      EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.auth_user_id = auth.uid()
          AND v.id::text = (storage.foldername(name))[1]
      )
      OR public.is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Vendor delegates owner update" ON storage.objects;
CREATE POLICY "Vendor delegates owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-delegates'
    AND (
      EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.auth_user_id = auth.uid()
          AND v.id::text = (storage.foldername(name))[1]
      )
      OR public.is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Vendor delegates owner delete" ON storage.objects;
CREATE POLICY "Vendor delegates owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-delegates'
    AND (
      EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.auth_user_id = auth.uid()
          AND v.id::text = (storage.foldername(name))[1]
      )
      OR public.is_admin(auth.uid())
    )
  );