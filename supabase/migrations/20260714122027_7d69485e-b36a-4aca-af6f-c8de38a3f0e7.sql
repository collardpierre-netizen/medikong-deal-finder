CREATE POLICY "Admins manage invoices bucket"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'invoices' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'invoices' AND public.is_admin(auth.uid()));