-- Allow admins full management of product-images, and authenticated vendors to upload
-- (write-only). Public read remains via existing policy.

CREATE POLICY "Admins manage product images insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins manage product images update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'product-images' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins manage product images delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin(auth.uid()));

-- Vendors can upload product images (write only, no delete/update for safety)
-- They must be linked to an active vendor profile.
CREATE POLICY "Vendors upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.auth_user_id = auth.uid() AND v.is_active = true
  )
);