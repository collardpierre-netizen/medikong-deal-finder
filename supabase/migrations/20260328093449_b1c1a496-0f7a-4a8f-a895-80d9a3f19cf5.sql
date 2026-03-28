CREATE TABLE public.cms_hero_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_hero_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read hero images" ON public.cms_hero_images
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins manage hero images" ON public.cms_hero_images
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

INSERT INTO public.cms_hero_images (image_url, alt_text, sort_order) VALUES
  ('https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&h=400&fit=crop', 'Médicaments et comprimés', 1),
  ('https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&h=400&fit=crop', 'Stéthoscope médical', 2),
  ('https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600&h=400&fit=crop', 'Gants médicaux', 3),
  ('https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=600&h=400&fit=crop', 'Masques chirurgicaux', 4),
  ('https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=400&fit=crop', 'Seringues et matériel médical', 5);