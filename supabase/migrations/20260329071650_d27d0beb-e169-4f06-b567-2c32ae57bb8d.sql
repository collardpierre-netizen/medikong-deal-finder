
CREATE TABLE public.cms_page_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  section_key text NOT NULL,
  image_url text NOT NULL,
  alt_text text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(page_key, section_key)
);

ALTER TABLE public.cms_page_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Page images publicly readable" ON public.cms_page_images
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins manage page images" ON public.cms_page_images
  FOR ALL TO authenticated USING (is_admin(auth.uid()));
