
-- ============================================================
-- PHASE 1: ReStock schema enrichment
-- ============================================================

-- 1. Add missing columns to restock_offers
ALTER TABLE public.restock_offers
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS unit_weight_g integer,
  ADD COLUMN IF NOT EXISTS price_ttc numeric GENERATED ALWAYS AS (ROUND(price_ht * (1 + vat_rate / 100), 2)) STORED,
  ADD COLUMN IF NOT EXISTS drop_id uuid REFERENCES public.restock_drops(id),
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 2. Add missing columns to restock_transactions
ALTER TABLE public.restock_transactions
  ADD COLUMN IF NOT EXISTS escrow_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS sendcloud_parcel_id text,
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS penalty_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_buyer_id uuid,
  ADD COLUMN IF NOT EXISTS invoice_seller_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3. Add missing columns to restock_buyers
ALTER TABLE public.restock_buyers
  ADD COLUMN IF NOT EXISTS verified_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS apn_number text,
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- 4. Invoices table (self-billing)
CREATE TABLE IF NOT EXISTS public.restock_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.restock_transactions(id),
  invoice_type text NOT NULL, -- 'buyer' or 'seller_credit'
  invoice_number text NOT NULL UNIQUE,
  amount_ht numeric NOT NULL,
  vat_amount numeric NOT NULL,
  amount_ttc numeric NOT NULL,
  commission_amount numeric NOT NULL DEFAULT 0,
  pdf_url text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restock_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invoices" ON public.restock_invoices FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Buyers see own invoices" ON public.restock_invoices FOR SELECT
  USING (transaction_id IN (
    SELECT id FROM restock_transactions WHERE buyer_id IN (
      SELECT id FROM restock_buyers WHERE auth_user_id = auth.uid()
    )
  ));
CREATE POLICY "Sellers see own invoices" ON public.restock_invoices FOR SELECT
  USING (transaction_id IN (
    SELECT id FROM restock_transactions WHERE seller_id = auth.uid()
  ));

-- 5. Invoice sequences
CREATE TABLE IF NOT EXISTS public.restock_invoice_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix text NOT NULL UNIQUE,
  current_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restock_invoice_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sequences" ON public.restock_invoice_sequences FOR ALL USING (is_admin(auth.uid()));

-- Insert default sequences
INSERT INTO public.restock_invoice_sequences (prefix, current_value) VALUES
  ('RS-B', 0),
  ('RS-S', 0)
ON CONFLICT (prefix) DO NOTHING;

-- 6. Referral system
CREATE TABLE IF NOT EXISTS public.restock_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,  -- auth user id of referrer
  uses_count integer NOT NULL DEFAULT 0,
  max_uses integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restock_referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage referral codes" ON public.restock_referral_codes FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Owners see own codes" ON public.restock_referral_codes FOR SELECT USING (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.restock_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.restock_referral_codes(id),
  referred_user_id uuid NOT NULL,
  referrer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restock_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage referrals" ON public.restock_referrals FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Users see own referrals" ON public.restock_referrals FOR SELECT USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.restock_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_type text NOT NULL, -- 'commission_discount', 'credit', 'badge'
  amount numeric,
  description text,
  referral_id uuid REFERENCES public.restock_referrals(id),
  is_claimed boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restock_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage rewards" ON public.restock_rewards FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Users see own rewards" ON public.restock_rewards FOR SELECT USING (user_id = auth.uid());

-- 7. Flake penalty counter on restock_buyers
ALTER TABLE public.restock_buyers
  ADD COLUMN IF NOT EXISTS flake_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz;

-- 8. Anonymization view (hides seller_id for non-admins)
CREATE OR REPLACE VIEW public.restock_public_offers_view AS
SELECT
  o.id, o.ean, o.cnk, o.designation, o.quantity, o.price_ht, o.price_ttc,
  o.vat_rate, o.dlu, o.product_state, o.grade, o.delivery_condition,
  o.photo_url, o.product_image_url, o.packaging_photos,
  o.allow_partial, o.moq, o.lot_size, o.unit_weight_g,
  o.seller_city, o.status, o.views_count, o.drop_id,
  o.created_at, o.updated_at, o.expires_at
  -- seller_id intentionally excluded
FROM public.restock_offers o
WHERE o.status = 'published';

-- 9. Add updated_at trigger on restock_transactions
CREATE TRIGGER update_restock_transactions_updated_at
  BEFORE UPDATE ON public.restock_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Insert missing settings
INSERT INTO public.restock_settings (key, value, label, description) VALUES
  ('escrow_hold_days', '3', 'Délai escrow (jours)', 'Jours de rétention après livraison confirmée'),
  ('flake_penalty_threshold', '3', 'Seuil pénalité flake', 'Nombre d''annulations avant suspension'),
  ('flake_suspension_days', '14', 'Durée suspension flake (jours)', 'Jours de suspension après dépassement du seuil'),
  ('sendcloud_enabled', 'false', 'Sendcloud activé', 'Activer l''intégration Sendcloud'),
  ('referral_reward_amount', '5', 'Récompense parrainage (€)', 'Montant crédit par filleul validé'),
  ('max_photos_per_offer', '5', 'Photos max par offre', 'Nombre maximum de photos par offre'),
  ('buyer_verification_required', 'true', 'Vérification acheteur obligatoire', 'Exiger la vérification APN avant achat')
ON CONFLICT (key) DO NOTHING;
