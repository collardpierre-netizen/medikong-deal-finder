-- Create product-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Product images publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Service role and admins can upload
CREATE POLICY "Service role uploads product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'service_role');

CREATE POLICY "Service role manages product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.role() = 'service_role');

CREATE POLICY "Service role deletes product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.role() = 'service_role');