
-- =============================================================
-- MediKong ReStock — schéma complet
-- =============================================================

-- 1. OFFRES DE DESTOCKAGE
CREATE TABLE public.restock_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  ean text,
  cnk text,
  designation text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price_ht numeric NOT NULL,
  dlu date,
  product_state text NOT NULL DEFAULT 'intact',
  lot_number text,
  delivery_condition text NOT NULL DEFAULT 'both',
  photo_url text,
  status text NOT NULL DEFAULT 'published',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restock_offers_qty_positive CHECK (quantity > 0),
  CONSTRAINT restock_offers_price_positive CHECK (price_ht > 0),
  CONSTRAINT restock_offers_state_check CHECK (product_state IN ('intact','damaged_packaging','near_expiry')),
  CONSTRAINT restock_offers_delivery_check CHECK (delivery_condition IN ('pickup','shipping','both')),
  CONSTRAINT restock_offers_status_check CHECK (status IN ('published','counter_offer','sold','rejected','expired'))
);

ALTER TABLE public.restock_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage own offers" ON public.restock_offers
  FOR ALL USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Admins manage all offers" ON public.restock_offers
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Published offers visible to all auth" ON public.restock_offers
  FOR SELECT USING (status = 'published' AND auth.uid() IS NOT NULL);

CREATE TRIGGER set_restock_offers_updated
  BEFORE UPDATE ON public.restock_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_restock_offers_seller ON public.restock_offers(seller_id);
CREATE INDEX idx_restock_offers_ean ON public.restock_offers(ean) WHERE ean IS NOT NULL;
CREATE INDEX idx_restock_offers_status ON public.restock_offers(status);

-- 2. ACHETEURS
CREATE TABLE public.restock_buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  pharmacy_name text NOT NULL,
  email text NOT NULL,
  phone text,
  city text,
  interests text[] DEFAULT '{}',
  reception_mode text NOT NULL DEFAULT 'email_portal',
  access_token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restock_buyers_mode_check CHECK (reception_mode IN ('email_portal','email_only','portal_only'))
);

ALTER TABLE public.restock_buyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage buyers" ON public.restock_buyers
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Buyers see own record" ON public.restock_buyers
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE TRIGGER set_restock_buyers_updated
  BEFORE UPDATE ON public.restock_buyers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. CONTRE-OFFRES
CREATE TABLE public.restock_counter_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.restock_offers(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.restock_buyers(id) ON DELETE CASCADE,
  proposed_price numeric NOT NULL,
  proposed_quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restock_co_price_positive CHECK (proposed_price > 0),
  CONSTRAINT restock_co_qty_positive CHECK (proposed_quantity > 0),
  CONSTRAINT restock_co_status_check CHECK (status IN ('pending','accepted','refused')),
  CONSTRAINT restock_co_unique UNIQUE (offer_id, buyer_id)
);

ALTER TABLE public.restock_counter_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage counter offers" ON public.restock_counter_offers
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Buyers create own counter offers" ON public.restock_counter_offers
  FOR INSERT WITH CHECK (
    buyer_id IN (SELECT id FROM public.restock_buyers WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Buyers see own counter offers" ON public.restock_counter_offers
  FOR SELECT USING (
    buyer_id IN (SELECT id FROM public.restock_buyers WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Sellers see counter offers on own offers" ON public.restock_counter_offers
  FOR SELECT USING (
    offer_id IN (SELECT id FROM public.restock_offers WHERE seller_id = auth.uid())
  );

CREATE POLICY "Sellers update counter offers on own offers" ON public.restock_counter_offers
  FOR UPDATE USING (
    offer_id IN (SELECT id FROM public.restock_offers WHERE seller_id = auth.uid())
  );

CREATE TRIGGER set_restock_counter_offers_updated
  BEFORE UPDATE ON public.restock_counter_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. CAMPAGNES EMAIL
CREATE TABLE public.restock_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  subject text NOT NULL,
  offer_ids uuid[] DEFAULT '{}',
  buyer_ids uuid[] DEFAULT '{}',
  sent_at timestamptz,
  open_count integer DEFAULT 0,
  take_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restock_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage campaigns" ON public.restock_campaigns
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. TRANSACTIONS
CREATE TABLE public.restock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.restock_offers(id),
  buyer_id uuid NOT NULL REFERENCES public.restock_buyers(id),
  seller_id uuid NOT NULL,
  final_price numeric NOT NULL,
  quantity integer NOT NULL,
  delivery_mode text NOT NULL DEFAULT 'pickup',
  shipping_cost numeric DEFAULT 0,
  commission_rate numeric DEFAULT 5,
  commission_amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restock_tx_delivery_check CHECK (delivery_mode IN ('pickup','shipping')),
  CONSTRAINT restock_tx_status_check CHECK (status IN ('confirmed','shipped','delivered'))
);

ALTER TABLE public.restock_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage transactions" ON public.restock_transactions
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Sellers see own transactions" ON public.restock_transactions
  FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "Buyers see own transactions" ON public.restock_transactions
  FOR SELECT USING (
    buyer_id IN (SELECT id FROM public.restock_buyers WHERE auth_user_id = auth.uid())
  );

-- 6. RÈGLES DE MODÉRATION
CREATE TABLE public.restock_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type text NOT NULL,
  label text,
  value jsonb NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restock_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage rules" ON public.restock_rules
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Rules readable by auth users" ON public.restock_rules
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE TRIGGER set_restock_rules_updated
  BEFORE UPDATE ON public.restock_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. DONNÉES DE DEMO
-- Règle par défaut : DLU minimum 1 mois
INSERT INTO public.restock_rules (rule_type, label, value, is_active)
VALUES ('min_dlu_months', 'DLU minimum', '{"months": 1}', true);
