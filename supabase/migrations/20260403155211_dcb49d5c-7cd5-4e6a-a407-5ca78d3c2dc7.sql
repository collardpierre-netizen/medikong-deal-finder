
CREATE TABLE public.cms_featured_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(category_id)
);

ALTER TABLE public.cms_featured_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Featured categories publicly readable"
  ON public.cms_featured_categories FOR SELECT
  TO public USING (true);

CREATE POLICY "Admins manage featured categories"
  ON public.cms_featured_categories FOR ALL
  TO authenticated USING (is_admin(auth.uid()));
