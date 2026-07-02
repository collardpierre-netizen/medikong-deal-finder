CREATE POLICY "Admins read media-library storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media-library' AND (is_admin(auth.uid()) OR is_super_admin(auth.uid())));

CREATE POLICY "Admins write media-library storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media-library' AND (is_admin(auth.uid()) OR is_super_admin(auth.uid())));

CREATE POLICY "Admins update media-library storage"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media-library' AND (is_admin(auth.uid()) OR is_super_admin(auth.uid())))
  WITH CHECK (bucket_id = 'media-library' AND (is_admin(auth.uid()) OR is_super_admin(auth.uid())));

CREATE POLICY "Admins delete media-library storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media-library' AND (is_admin(auth.uid()) OR is_super_admin(auth.uid())));