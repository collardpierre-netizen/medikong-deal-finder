
-- Table for per-profile pricing, MOV and MOQ rules on offers
CREATE TABLE public.offer_profile_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  profile_type text NOT NULL, -- matches customer_type or profession_types values
  country_code text, -- null = all countries
  custom_price_excl_vat numeric, -- fixed price override (null = use discount)
  discount_percentage numeric DEFAULT 0, -- % discount from base price (used when custom_price is null)
  moq integer DEFAULT 1,
  mov_amount numeric DEFAULT 0,
  mov_currency text DEFAULT 'EUR',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(offer_id, profile_type, country_code)
);

ALTER TABLE public.offer_profile_rules ENABLE ROW LEVEL SECURITY;

-- Vendors manage their own rules
CREATE POLICY "Vendors manage own profile rules"
ON public.offer_profile_rules FOR ALL TO authenticated
USING (offer_id IN (
  SELECT o.id FROM offers o
  JOIN vendors v ON v.id = o.vendor_id
  WHERE v.auth_user_id = auth.uid()
))
WITH CHECK (offer_id IN (
  SELECT o.id FROM offers o
  JOIN vendors v ON v.id = o.vendor_id
  WHERE v.auth_user_id = auth.uid()
));

-- Admins full access
CREATE POLICY "Admins manage offer_profile_rules"
ON public.offer_profile_rules FOR ALL TO authenticated
USING (is_admin(auth.uid()));

-- Public read for price display
CREATE POLICY "Profile rules publicly readable"
ON public.offer_profile_rules FOR SELECT TO public
USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_offer_profile_rules_updated_at
BEFORE UPDATE ON public.offer_profile_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_offer_profile_rules_offer ON public.offer_profile_rules(offer_id);
CREATE INDEX idx_offer_profile_rules_profile ON public.offer_profile_rules(profile_type);
