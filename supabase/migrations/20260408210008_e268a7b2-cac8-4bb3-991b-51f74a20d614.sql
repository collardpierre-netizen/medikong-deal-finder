
-- 1) Price references table
CREATE TABLE IF NOT EXISTS public.price_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ean text UNIQUE,
  cnk text,
  designation text NOT NULL,
  category text,
  public_price_eur numeric(10,2),
  pharmacist_price_estimated_eur numeric(10,2),
  vat_rate integer DEFAULT 21,
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read price_references"
  ON public.price_references FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage price_references"
  ON public.price_references FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_price_references_ean ON public.price_references(ean);
CREATE INDEX idx_price_references_cnk ON public.price_references(cnk);

CREATE TRIGGER update_price_references_updated_at
  BEFORE UPDATE ON public.price_references
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) FAQ items table
CREATE TABLE IF NOT EXISTS public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'legal',
  question text NOT NULL,
  answer_html text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  version text DEFAULT '1.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published faq_items"
  ON public.faq_items FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage faq_items"
  ON public.faq_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_faq_items_updated_at
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Restock ratings table
CREATE TABLE IF NOT EXISTS public.restock_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.restock_transactions(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL,
  ratee_id uuid NOT NULL,
  rater_role text NOT NULL CHECK (rater_role IN ('buyer','seller')),
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(transaction_id, rater_role)
);

ALTER TABLE public.restock_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read ratings"
  ON public.restock_ratings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Rater can insert own rating"
  ON public.restock_ratings FOR INSERT TO authenticated
  WITH CHECK (rater_id = auth.uid());

-- 4) Add legal FAQ acknowledgment to restock_buyers
ALTER TABLE public.restock_buyers
  ADD COLUMN IF NOT EXISTS legal_faq_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_faq_version_acknowledged text;

-- 5) Insert missing settings keys
INSERT INTO public.restock_settings (key, value, label, description) VALUES
  ('shipping_rate_0_2kg', '7.50', 'Tarif livraison 0-2kg', 'EUR HT'),
  ('shipping_rate_2_5kg', '9.90', 'Tarif livraison 2-5kg', 'EUR HT'),
  ('shipping_rate_5_10kg', '13.90', 'Tarif livraison 5-10kg', 'EUR HT'),
  ('shipping_rate_10_20kg', '18.50', 'Tarif livraison 10-20kg', 'EUR HT'),
  ('shipping_rate_20_30kg', '24.90', 'Tarif livraison 20-30kg', 'EUR HT'),
  ('destruction_cost_per_unit_eur', '1.20', 'Coût destruction/unité', 'Coût moyen collecte pharma-déchets (Valipac/Phaltrap)'),
  ('pricing_ratio_rx', '0.69', 'Ratio marge pharmacien Rx', 'Pour estimer prix pharmacien depuis PP'),
  ('pricing_ratio_otc', '0.55', 'Ratio marge OTC', 'Pour estimer prix pharmacien OTC'),
  ('pricing_widget_enabled', 'true', 'Widget Smart Pricing actif', 'Affiche les suggestions de prix au vendeur'),
  ('pricing_zone_red_max', '20', 'Zone rouge max %', 'Décote max pour zone "Hors marché"'),
  ('pricing_zone_yellow_max', '40', 'Zone jaune max %', 'Décote max pour zone "Acceptable"'),
  ('pricing_zone_green_max', '70', 'Zone verte max %', 'Décote max pour zone "Sweet spot"'),
  ('allowed_categories', '[]', 'Catégories autorisées', 'JSON array — vide = toutes autorisées'),
  ('forbidden_cnk_patterns', '[]', 'CNK interdits (préfixes)', 'JSON array de préfixes CNK bloqués'),
  ('qa_forbidden_keywords', '["email","telephone","whatsapp","tel","gsm","@"]', 'Mots-clés Q&A bloqués', 'Filtre anti-contournement'),
  ('legal_faq_acknowledgment_required', 'true', 'Acknowledgment FAQ obligatoire', 'Modal bloquant au 1er upload'),
  ('legal_faq_version', '1.0', 'Version FAQ légale', 'Incrémentée = force re-acknowledgment'),
  ('invoice_footer_text', 'MediKong SA — TVA BE0XXX.XXX.XXX — Marketplace B2B réservée aux pharmaciens titulaires', 'Pied de facture', 'Mentions légales factures'),
  ('cgu_mandate_clause', 'Le vendeur autorise MediKong SA à émettre des factures en son nom et pour son compte conformément à l''art. 53octies §1 du Code TVA belge.', 'Clause mandat self-billing', 'Texte CGU mandat facturation'),
  ('referral_reward_description', 'Parrainez un confrère : 50€ de crédit après sa 1ère transaction réussie', 'Description récompense parrainage', 'Affiché sur la page parrainage')
ON CONFLICT (key) DO NOTHING;
