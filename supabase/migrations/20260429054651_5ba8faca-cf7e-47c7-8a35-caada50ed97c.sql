-- Allow admins to upload/update/delete logos for external vendors in vendor-branding bucket
CREATE POLICY "Admins manage external vendor branding"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'vendor-branding'
  AND public.is_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'vendor-branding'
  AND public.is_admin(auth.uid())
);