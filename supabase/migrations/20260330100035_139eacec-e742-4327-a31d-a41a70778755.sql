
-- 1. Create manufacturers table
CREATE TABLE public.manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qogita_qid text UNIQUE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  legal_name text,
  logo_url text,
  website_url text,
  description text,
  country_of_origin text,
  year_founded integer,
  certifications text[] DEFAULT '{}',
  specialties text[] DEFAULT '{}',
  product_count integer DEFAULT 0,
  brand_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Add manufacturer_id to brands
ALTER TABLE public.brands ADD COLUMN manufacturer_id uuid REFERENCES public.manufacturers(id);
ALTER TABLE public.brands ADD COLUMN website_url text;
ALTER TABLE public.brands ADD COLUMN country_of_origin text;

-- 3. Add manufacturer_id to products
ALTER TABLE public.products ADD COLUMN manufacturer_id uuid REFERENCES public.manufacturers(id);

-- 4. RLS policies for manufacturers
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manufacturers publicly readable"
ON public.manufacturers FOR SELECT TO public
USING (true);

CREATE POLICY "Admins manage manufacturers"
ON public.manufacturers FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

-- 5. Trigger for updated_at
CREATE TRIGGER set_manufacturers_updated_at
  BEFORE UPDATE ON public.manufacturers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Index for performance
CREATE INDEX idx_manufacturers_slug ON public.manufacturers(slug);
CREATE INDEX idx_brands_manufacturer_id ON public.brands(manufacturer_id);
CREATE INDEX idx_products_manufacturer_id ON public.products(manufacturer_id);
