-- media_assets : remplacer la policy authenticated
DROP POLICY IF EXISTS "Authenticated can view public+auth active media" ON public.media_assets;

CREATE POLICY "Verified buyers/admins read non-premium media"
  ON public.media_assets FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      visibility = 'public'
      OR (
        visibility = 'authenticated'
        AND public.is_verified_buyer_or_admin(auth.uid())
      )
    )
  );

-- Storage : remplacer la policy SELECT du bucket media-assets
DROP POLICY IF EXISTS "Admins read media-assets bucket" ON storage.objects;

CREATE POLICY "Verified buyers/admins read media-assets bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'media-assets'
    AND public.is_verified_buyer_or_admin(auth.uid())
  );