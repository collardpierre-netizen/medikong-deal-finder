-- ============================================================================
-- LOT 1 — MediKong Scan — fondations (BROUILLON, NON APPLIQUÉ)
-- Migration strictement additive. Aucune donnée existante réécrite.
-- ============================================================================

-- 1. Comptes (arbitrages 1, 10, 12) ------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS scan_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS be_pharmacy_id uuid NULL REFERENCES public.be_pharmacies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS customers_be_pharmacy_id_idx ON public.customers(be_pharmacy_id);

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS scan_enabled boolean NOT NULL DEFAULT false;

-- 2. Codes produit (arbitrage 6) ----------------------------------------------
-- Colonne générée STORED : Postgres réécrit physiquement la table products
-- (verrou le temps de l'opération), mais aucune valeur existante n'est modifiée.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cnk_normalized text
  GENERATED ALWAYS AS (NULLIF(regexp_replace(coalesce(cnk_code, ''), '\D', '', 'g'), '')) STORED;
CREATE INDEX IF NOT EXISTS products_cnk_normalized_idx ON public.products(cnk_normalized);
CREATE INDEX IF NOT EXISTS products_gtin_idx ON public.products(gtin) WHERE gtin IS NOT NULL AND gtin <> '';

ALTER TABLE public.product_market_codes
  ADD COLUMN IF NOT EXISTS code_normalized text
  GENERATED ALWAYS AS (NULLIF(regexp_replace(coalesce(code_value, ''), '\D', '', 'g'), '')) STORED;
CREATE INDEX IF NOT EXISTS product_market_codes_code_normalized_idx ON public.product_market_codes(code_normalized);

-- 3. Grossistes (arbitrages 3, 4) ---------------------------------------------
ALTER TABLE public.wholesaler_profiles
  ADD COLUMN IF NOT EXISTS display_prices_allowed boolean NOT NULL DEFAULT false;

-- Prix catalogue grossiste : market_prices stocke déjà prix_grossiste par produit
-- et par source (Febelco, CERP, Phoenix…). On relie simplement la source au profil.
ALTER TABLE public.market_price_sources
  ADD COLUMN IF NOT EXISTS wholesaler_profile_id uuid NULL REFERENCES public.wholesaler_profiles(id) ON DELETE SET NULL;

CREATE TABLE public.wholesaler_depots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_profile_id uuid NOT NULL REFERENCES public.wholesaler_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  postal_code text,
  country_code text NOT NULL DEFAULT 'BE',
  latitude numeric,
  longitude numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wholesaler_depots TO authenticated;
GRANT ALL ON public.wholesaler_depots TO service_role;
ALTER TABLE public.wholesaler_depots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "depots read active" ON public.wholesaler_depots
  FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "depots admin manage" ON public.wholesaler_depots
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 4. Remises pharmacien (arbitrage 2) -----------------------------------------
ALTER TABLE public.pharmacist_wholesaler_settings
  ADD COLUMN IF NOT EXISTS customer_id uuid NULL REFERENCES public.customers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS pws_customer_id_idx ON public.pharmacist_wholesaler_settings(customer_id);

-- Policy actuelle conservée telle quelle : pws_owner_all (user_id = auth.uid()).
-- Ajout : membres actifs du compte customer rattaché. Aucune policy admin/vendeur.
CREATE POLICY "pws_customer_members_all" ON public.pharmacist_wholesaler_settings
  FOR ALL TO authenticated
  USING (customer_id IS NOT NULL AND customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
    UNION SELECT unnest(public.current_user_buyer_account_ids())))
  WITH CHECK (customer_id IS NOT NULL AND customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
    UNION SELECT unnest(public.current_user_buyer_account_ids())));

-- Liste des grossistes pour Scan sans exposer extraction_hints_json
CREATE OR REPLACE FUNCTION public.scan_list_wholesalers()
RETURNS TABLE(id uuid, slug text, display_name text, country text, discount_mechanic text,
              default_discount_pct numeric, display_prices_allowed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, slug, display_name, country, discount_mechanic, default_discount_pct, display_prices_allowed
  FROM public.wholesaler_profiles WHERE is_active AND auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.scan_list_wholesalers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.scan_list_wholesalers() TO authenticated;

-- 5. Événements de scan -------------------------------------------------------
CREATE TABLE public.scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  raw_code text NOT NULL,
  code_kind text,                    -- gtin | cnk | unknown
  match_status text NOT NULL,        -- matched | ambiguous_match | no_offer | not_found
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  candidate_product_ids uuid[] NOT NULL DEFAULT '{}',
  best_offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  best_price_excl_vat numeric,       -- euros, même type que offers.price_excl_vat
  reference_price_excl_vat numeric,  -- prix pharmacien calculé (grossiste - remise)
  mode text NOT NULL DEFAULT 'single', -- single | burst
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scan_events_customer_created_idx ON public.scan_events(customer_id, created_at DESC);
GRANT SELECT, INSERT ON public.scan_events TO authenticated;
GRANT ALL ON public.scan_events TO service_role;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan events own read" ON public.scan_events FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
                         UNION SELECT unnest(public.current_user_buyer_account_ids())));
CREATE POLICY "scan events admin read" ON public.scan_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
-- Insertion uniquement par l'edge function scan-resolve (service_role).

-- 6. Attribution panier (arbitrage 8) -----------------------------------------
CREATE TABLE public.scan_cart_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  scan_event_id uuid NOT NULL REFERENCES public.scan_events(id) ON DELETE CASCADE,
  order_line_id uuid NULL REFERENCES public.order_lines(id) ON DELETE SET NULL,
  matched_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scan_cart_attr_lookup_idx ON public.scan_cart_attributions(customer_id, offer_id, created_at DESC);
GRANT SELECT, INSERT ON public.scan_cart_attributions TO authenticated;
GRANT ALL ON public.scan_cart_attributions TO service_role;
ALTER TABLE public.scan_cart_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan attr own" ON public.scan_cart_attributions FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
                         UNION SELECT unnest(public.current_user_buyer_account_ids())));
CREATE POLICY "scan attr own insert" ON public.scan_cart_attributions FOR INSERT TO authenticated
  WITH CHECK (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
                              UNION SELECT unnest(public.current_user_buyer_account_ids()))
              AND EXISTS (SELECT 1 FROM public.scan_events e WHERE e.id = scan_event_id AND e.customer_id = customer_id));
CREATE POLICY "scan attr admin read" ON public.scan_cart_attributions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Rapprochement à la création d'une ligne de commande (fenêtre 7 jours).
CREATE OR REPLACE FUNCTION public._scan_attribute_order_line()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _customer uuid;
BEGIN
  SELECT o.customer_id INTO _customer FROM public.orders o WHERE o.id = NEW.order_id;
  IF _customer IS NULL OR NEW.offer_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.scan_cart_attributions a SET order_line_id = NEW.id, matched_at = now()
  WHERE a.id = (SELECT id FROM public.scan_cart_attributions
                WHERE customer_id = _customer AND offer_id = NEW.offer_id
                  AND order_line_id IS NULL AND created_at >= now() - interval '7 days'
                ORDER BY created_at DESC LIMIT 1);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_scan_attribute_order_line AFTER INSERT ON public.order_lines
  FOR EACH ROW EXECUTE FUNCTION public._scan_attribute_order_line();

-- 7. Sourcing (arbitrage 9) ---------------------------------------------------
ALTER TABLE public.sourcing_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS monthly_quantity integer,
  ADD COLUMN IF NOT EXISTS current_price_excl_vat numeric,
  ADD COLUMN IF NOT EXISTS current_supplier text,
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS sourcing_item_id uuid REFERENCES public.buyer_comparator_sourcing_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scan_event_id uuid REFERENCES public.scan_events(id) ON DELETE SET NULL;

-- 8. Complétion EAN via import Febelco/CERP (arbitrage 7) ---------------------
CREATE TABLE public.product_gtin_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  proposed_gtin text NOT NULL,
  source_id uuid REFERENCES public.market_price_sources(id) ON DELETE SET NULL,
  matched_cnk text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, proposed_gtin)
);
GRANT SELECT, INSERT, UPDATE ON public.product_gtin_proposals TO authenticated;
GRANT ALL ON public.product_gtin_proposals TO service_role;
ALTER TABLE public.product_gtin_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gtin proposals admin" ON public.product_gtin_proposals FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
-- RPC admin_generate_gtin_proposals() (lecture market_prices.ean par CNK normalisé,
-- products.gtin vide uniquement) + admin_apply_gtin_proposal(id) : écrit products.gtin
-- seulement après validation, jamais si le gtin a été rempli entre-temps.
