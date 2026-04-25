-- Ajout des champs de branding au profil vendeur
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS twitter_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Bucket public dédié aux assets de branding vendeur (logos + bannières)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-branding', 'vendor-branding', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique du bucket
DROP POLICY IF EXISTS "Vendor branding public read" ON storage.objects;
CREATE POLICY "Vendor branding public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-branding');

-- Upload : un vendeur (ou un admin) peut écrire dans son propre dossier vendor_id/...
DROP POLICY IF EXISTS "Vendor branding owner upload" ON storage.objects;
CREATE POLICY "Vendor branding owner upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-branding'
    AND (
      EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.auth_user_id = auth.uid()
          AND v.id::text = (storage.foldername(name))[1]
      )
      OR public.is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Vendor branding owner update" ON storage.objects;
CREATE POLICY "Vendor branding owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-branding'
    AND (
      EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.auth_user_id = auth.uid()
          AND v.id::text = (storage.foldername(name))[1]
      )
      OR public.is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Vendor branding owner delete" ON storage.objects;
CREATE POLICY "Vendor branding owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-branding'
    AND (
      EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.auth_user_id = auth.uid()
          AND v.id::text = (storage.foldername(name))[1]
      )
      OR public.is_admin(auth.uid())
    )
  );