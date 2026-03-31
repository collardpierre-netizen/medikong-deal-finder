
-- 1. Profils utilisateurs
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.user_profiles (name, slug, description, display_order) VALUES
  ('Distributeur / Grossiste', 'distributeur', 'Grossistes et distributeurs pharma/dental', 1),
  ('Pharmacien', 'pharmacien', 'Pharmaciens indépendants et groupements', 2),
  ('Infirmier(e)', 'infirmier', 'Infirmiers indépendants, cabinets, soins à domicile', 3),
  ('Dentiste', 'dentiste', 'Cabinets dentaires', 4),
  ('Hôpital / Clinique', 'hopital', 'Établissements hospitaliers', 5),
  ('Maison de repos', 'maison-de-repos', 'MRS et maisons de repos', 6),
  ('Vétérinaire', 'veterinaire', 'Cabinets vétérinaires', 7)
ON CONFLICT (slug) DO NOTHING;

-- 2. Visibilité par profil
CREATE TABLE IF NOT EXISTS public.profile_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, feature_key)
);

-- 3. Assignation profil utilisateur
CREATE TABLE IF NOT EXISTS public.user_profile_assignments (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Sources de prix du marché
CREATE TABLE IF NOT EXISTS public.market_price_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL DEFAULT 'wholesaler',
  country_code TEXT DEFAULT 'BE',
  file_format TEXT,
  is_active BOOLEAN DEFAULT true,
  last_import_at TIMESTAMPTZ,
  total_products INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.market_price_sources (name, slug, source_type, file_format) VALUES
  ('Febelco', 'febelco', 'wholesaler', 'febelco_xlsx'),
  ('CERP', 'cerp', 'wholesaler', 'cerp_xlsx'),
  ('Medi-Market', 'medi-market', 'retailer', NULL),
  ('Multipharma', 'multipharma', 'retailer', NULL),
  ('Farmaline', 'farmaline', 'retailer', NULL),
  ('Newpharma', 'newpharma', 'retailer', NULL),
  ('Basiq Dental', 'basiq-dental', 'competitor', NULL),
  ('DPI Dental Promotion', 'dpi', 'competitor', NULL)
ON CONFLICT (slug) DO NOTHING;

-- 5. Prix du marché par produit
CREATE TABLE IF NOT EXISTS public.market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.market_price_sources(id) ON DELETE CASCADE,
  cnk TEXT,
  ean TEXT,
  product_name_source TEXT,
  prix_grossiste NUMERIC,
  prix_pharmacien NUMERIC,
  prix_public NUMERIC,
  tva_rate NUMERIC,
  supplier_name TEXT,
  supplier_code TEXT,
  product_url TEXT,
  is_matched BOOLEAN DEFAULT false,
  imported_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, cnk)
);

CREATE INDEX IF NOT EXISTS idx_market_prices_product ON public.market_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_market_prices_source ON public.market_prices(source_id);
CREATE INDEX IF NOT EXISTS idx_market_prices_cnk ON public.market_prices(cnk);
CREATE INDEX IF NOT EXISTS idx_market_prices_ean ON public.market_prices(ean);

-- 6. Config source par profil
CREATE TABLE IF NOT EXISTS public.source_profile_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.market_price_sources(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  display_mode TEXT NOT NULL DEFAULT 'market_price',
  display_label TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, profile_id)
);

-- 7. RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_price_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_profile_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_user_profiles" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "admin_all_user_profiles" ON public.user_profiles FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "public_read_profile_visibility" ON public.profile_visibility FOR SELECT USING (true);
CREATE POLICY "admin_all_profile_visibility" ON public.profile_visibility FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "own_read_assignments" ON public.user_profile_assignments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin_all_assignments" ON public.user_profile_assignments FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "public_read_market_sources" ON public.market_price_sources FOR SELECT USING (true);
CREATE POLICY "admin_all_market_sources" ON public.market_price_sources FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "public_read_market_prices" ON public.market_prices FOR SELECT USING (true);
CREATE POLICY "admin_all_market_prices" ON public.market_prices FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "public_read_source_profile_config" ON public.source_profile_config FOR SELECT USING (true);
CREATE POLICY "admin_all_source_profile_config" ON public.source_profile_config FOR ALL TO authenticated USING (is_admin(auth.uid()));
