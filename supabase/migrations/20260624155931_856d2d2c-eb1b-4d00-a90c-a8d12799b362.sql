
CREATE POLICY "Admins read quote pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'quote-pdfs' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins insert quote pdfs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'quote-pdfs' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins update quote pdfs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'quote-pdfs' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins delete quote pdfs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'quote-pdfs' AND public.is_admin(auth.uid()));

CREATE POLICY "Vendors read own quote pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'quote-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.pdf_storage_path = storage.objects.name
      AND q.vendor_id = public.current_vendor_id()
  )
);
