
-- Create storage bucket for CMS hero images
INSERT INTO storage.buckets (id, name, public) VALUES ('cms-images', 'cms-images', true);

-- Allow public read access
CREATE POLICY "Public read cms-images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'cms-images');

-- Allow admins to upload/update/delete
CREATE POLICY "Admins upload cms-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cms-images' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update cms-images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cms-images' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete cms-images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cms-images' AND public.is_admin(auth.uid()));
