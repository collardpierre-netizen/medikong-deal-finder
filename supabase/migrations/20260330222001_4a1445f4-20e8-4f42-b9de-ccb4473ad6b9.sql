
-- Table de reference des types de codes par marche
CREATE TABLE IF NOT EXISTS market_code_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  description TEXT,
  validation_regex TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO market_code_types (code, label, country_code, country_name, description, validation_regex, sort_order) VALUES
  ('cnk', 'N° CNK', 'BE', 'Belgique', 'Code National Kode - identifiant belge pour produits pharmaceutiques et parapharmaceutiques', '^\d{7}$', 1),
  ('pzn', 'PZN', 'DE', 'Allemagne', 'Pharmazentralnummer - identifiant allemand pour produits pharmaceutiques', '^\d{7,8}$', 2),
  ('cip', 'Code CIP', 'FR', 'France', 'Code Identifiant de Presentation - identifiant francais pour medicaments', '^\d{7}$|^\d{13}$', 3),
  ('nhr', 'NHR Code', 'NL', 'Pays-Bas', 'Registratienummer - identifiant neerlandais', NULL, 4),
  ('aic', 'Codice AIC', 'IT', 'Italie', 'Autorizzazione Immissione in Commercio - identifiant italien', '^\d{9}$', 5),
  ('cn', 'Codigo Nacional', 'ES', 'Espagne', 'Codigo Nacional - identifiant espagnol', '^\d{6,7}$', 6)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE market_code_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read market_code_types"
  ON market_code_types FOR SELECT TO public USING (true);

CREATE POLICY "Admins manage market_code_types"
  ON market_code_types FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- Table des codes produit
CREATE TABLE IF NOT EXISTS product_market_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  market_code_type_id UUID REFERENCES market_code_types(id) ON DELETE CASCADE,
  code_value TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  source TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, market_code_type_id)
);

CREATE INDEX idx_product_market_codes_product ON product_market_codes(product_id);
CREATE INDEX idx_product_market_codes_value ON product_market_codes(code_value);
CREATE INDEX idx_product_market_codes_type ON product_market_codes(market_code_type_id);

ALTER TABLE product_market_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read product_market_codes"
  ON product_market_codes FOR SELECT TO public USING (true);

CREATE POLICY "Admins manage product_market_codes"
  ON product_market_codes FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- Add product dimension columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight DECIMAL(10,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS height DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS width DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS depth DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kg';
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimension_unit TEXT DEFAULT 'cm';
