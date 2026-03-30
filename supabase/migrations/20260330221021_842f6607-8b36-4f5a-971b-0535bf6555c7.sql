CREATE TABLE IF NOT EXISTS offer_price_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES offers(id) ON DELETE CASCADE NOT NULL,
  min_order_value DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE offer_price_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Offer price tiers publicly readable"
  ON offer_price_tiers FOR SELECT TO public USING (true);

CREATE POLICY "Admins manage offer_price_tiers"
  ON offer_price_tiers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_offer_price_tiers_offer ON offer_price_tiers(offer_id);