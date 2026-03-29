
CREATE TABLE public.cms_hero_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  alt_text text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_hero_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hero images publicly readable" ON public.cms_hero_images FOR SELECT TO public USING (true);
CREATE POLICY "Admins manage hero images" ON public.cms_hero_images FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Seed default images
INSERT INTO public.cms_hero_images (image_url, alt_text, sort_order, is_active) VALUES
  ('https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=900&q=80', 'Fournitures médicales', 0, true),
  ('https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=900&q=80', 'Équipement médical', 1, true),
  ('https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=900&q=80', 'Pharmacie professionnelle', 2, true);
