CREATE TABLE IF NOT EXISTS user_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  my_purchase_price DECIMAL(10,2) NOT NULL,
  supplier_name TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE user_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prices"
  ON user_prices FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_prices_user ON user_prices(user_id);
CREATE INDEX idx_user_prices_product ON user_prices(product_id);