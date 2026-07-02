DROP POLICY IF EXISTS "Vendors upload product images" ON storage.objects;

CREATE POLICY "Vendors upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
        AND v.is_active = true
        AND (v.id)::text = (storage.foldername(objects.name))[1]
    )
  )
);