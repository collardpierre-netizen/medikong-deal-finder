
-- Table de reference des niveaux de prix
CREATE TABLE IF NOT EXISTS price_levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  label_fr TEXT NOT NULL,
  label_en TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO price_levels (code, label_fr, label_en, sort_order) VALUES
  ('public', 'Prix public (TVAC)', 'Public price (incl. VAT)', 1),
  ('pharmacien', 'Prix pharmacien (HTVA)', 'Pharmacist price (excl. VAT)', 2),
  ('grossiste', 'Prix grossiste (HTVA)', 'Wholesaler price (excl. VAT)', 3),
  ('hopital', 'Prix hospitalier (HTVA)', 'Hospital price (excl. VAT)', 4),
  ('medikong', 'Prix MediKong (HTVA)', 'MediKong price (excl. VAT)', 5)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE price_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read price_levels"
  ON price_levels FOR SELECT TO public USING (true);

CREATE POLICY "Admins manage price_levels"
  ON price_levels FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- Prix par produit et par niveau
CREATE TABLE IF NOT EXISTS product_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  price_level_id UUID REFERENCES price_levels(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  source TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, price_level_id)
);

CREATE INDEX idx_product_prices_product ON product_prices(product_id);
CREATE INDEX idx_product_prices_level ON product_prices(price_level_id);

ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read product_prices"
  ON product_prices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage product_prices"
  ON product_prices FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- Ajouter le niveau de prix au profil
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS price_level_code TEXT DEFAULT 'pharmacien';
