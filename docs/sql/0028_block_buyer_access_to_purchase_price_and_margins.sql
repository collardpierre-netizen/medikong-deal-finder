-- LOT 0028 — L'acheteur ne peut plus lire le prix d'achat, la marge fournisseur ni la marge MediKong
-- Principe : les surfaces acheteur passent par des vues sans colonnes de coût/marge/commission.
-- La table `offers` reste lisible par le vendeur (ses propres offres) et par l'admin.
-- Aucune donnée n'est modifiée ; uniquement des vues + des policies de lecture.

-- 1) Vue acheteur/public des offres (colonnes commerciales uniquement)
CREATE OR REPLACE VIEW public.offers_public_v
WITH (security_invoker = true) AS
SELECT
  o.id, o.product_id, o.vendor_id,
  o.price_excl_vat, o.price_incl_vat, o.vat_rate,
  o.moq, o.mov, o.mov_amount, o.mov_currency,
  o.stock_quantity, o.stock_status,
  o.delivery_days, o.min_delivery_days, o.max_delivery_days, o.estimated_delivery_days,
  o.has_extended_delivery, o.shipping_from_country,
  o.price_tiers, o.is_traceable, o.down_payment_pct,
  o.is_qogita_backed, o.qogita_offer_qid, o.is_top_seller,
  o.pack_size_override, o.carton_size_override, o.packaging_languages,
  o.suggested_retail_price_cents, o.suggested_retail_price_source,
  o.campaign_id, o.cagnotte_eligible, o.vendor_reference,
  o.country_code, o.country_codes,
  o.price_stale, o.price_stale_since, o.last_verified_at,
  o.is_active, o.synced_at, o.created_at, o.updated_at
FROM public.offers o
WHERE o.is_active = true;

GRANT SELECT ON public.offers_public_v TO anon, authenticated;

-- 2) Vue acheteur des paliers de prix (sans margin_amount)
CREATE OR REPLACE VIEW public.offer_price_tiers_public_v
WITH (security_invoker = true) AS
SELECT t.id, t.offer_id, t.tier_index, t.mov_threshold, t.mov_currency,
       t.price_excl_vat, t.price_incl_vat, t.mov_progress, t.is_active, t.created_at
FROM public.offer_price_tiers t
WHERE t.is_active = true;

GRANT SELECT ON public.offer_price_tiers_public_v TO anon, authenticated;

-- 3) Fermeture de la lecture directe des tables porteuses de coûts
--    offers : ne restent que « vendeur sur ses offres » et « admin »
DROP POLICY IF EXISTS "Offers public read active" ON public.offers;
DROP POLICY IF EXISTS "Offers read active verified" ON public.offers;

CREATE POLICY "Offers read own vendor rows"
ON public.offers FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR vendor_id IN (SELECT v.id FROM public.vendors v WHERE v.auth_user_id = auth.uid())
);

REVOKE SELECT ON public.offers FROM anon;

--    offer_price_tiers : la policy acheteur vérifiée disparaît (vue dédiée à la place)
DROP POLICY IF EXISTS "Verified buyers read active offer price tiers" ON public.offer_price_tiers;

-- 4) Filet de sécurité : les vues acheteur ne doivent jamais reprendre ces colonnes
--    (contrôle manuel à rejouer après toute évolution de `offers`)
--    purchase_price, purchase_price_excl_vat, qogita_base_price,
--    margin_amount, applied_margin_percentage, applied_margin_rule_id,
--    margin_split_pct, margin_share_medikong_pct, margin_share_medista_pct,
--    commission_model, commission_rate, fixed_commission_amount,
--    commission_override_*, commission_valid_from, commission_valid_until,
--    source_supplier, vendor_note, admin_hidden_*, price_outlier_*
