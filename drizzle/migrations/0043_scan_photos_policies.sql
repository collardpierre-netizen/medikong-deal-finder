CREATE POLICY scan_photos_member_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'scan-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text FROM public.customers c WHERE c.auth_user_id = auth.uid()
    UNION
    SELECT x::text FROM public.current_user_buyer_account_ids() x
  )
);

CREATE POLICY scan_photos_member_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'scan-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text FROM public.customers c WHERE c.auth_user_id = auth.uid()
    UNION
    SELECT x::text FROM public.current_user_buyer_account_ids() x
  )
);