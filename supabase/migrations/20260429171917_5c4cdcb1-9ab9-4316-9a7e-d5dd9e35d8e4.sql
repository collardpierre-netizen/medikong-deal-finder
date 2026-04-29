-- Fusion offer_profile_rules → offer_buyer_profile_prices
-- offer_buyer_profile_prices devient la table unique : prix + MOQ + MOV par offre+profil

-- 1) Ajouter les colonnes MOQ/MOV/contraintes
ALTER TABLE public.offer_buyer_profile_prices
  ADD COLUMN IF NOT EXISTS min_order_quantity integer,
  ADD COLUMN IF NOT EXISTS min_order_value_cents integer,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Index utile
CREATE INDEX IF NOT EXISTS idx_obpp_offer_profile
  ON public.offer_buyer_profile_prices(offer_id, buyer_profile_id);

-- 2) Migrer les données existantes (no-op aujourd'hui, 0 rows)
-- mov_amount est en EUR (numeric), on convertit en cents
INSERT INTO public.offer_buyer_profile_prices (
  offer_id, buyer_profile_id, pricing_mode, price_excl_vat, discount_pct,
  min_order_quantity, min_order_value_cents, country_code, is_active
)
SELECT
  opr.offer_id,
  opr.profile_type AS buyer_profile_id,
  CASE
    WHEN opr.custom_price_excl_vat IS NOT NULL THEN 'absolute'
    WHEN opr.discount_percentage IS NOT NULL AND opr.discount_percentage <> 0 THEN 'discount_pct'
    ELSE 'absolute'
  END AS pricing_mode,
  opr.custom_price_excl_vat,
  NULLIF(opr.discount_percentage, 0),
  COALESCE(opr.moq, 1),
  CASE WHEN opr.mov_amount IS NOT NULL THEN ROUND(opr.mov_amount * 100)::integer ELSE NULL END,
  opr.country_code,
  COALESCE(opr.is_active, true)
FROM public.offer_profile_rules opr
WHERE NOT EXISTS (
  SELECT 1 FROM public.offer_buyer_profile_prices x
  WHERE x.offer_id = opr.offer_id AND x.buyer_profile_id = opr.profile_type
);

-- 3) Drop l'ancienne table (RLS, policies, trigger, index, FK partent avec)
DROP TABLE IF EXISTS public.offer_profile_rules CASCADE;

-- 4) Commentaire d'autorité
COMMENT ON TABLE public.offer_buyer_profile_prices IS
  'Source unique des règles par offre × profil acheteur : prix (absolute/discount_pct), MOQ, MOV. Remplace offer_profile_rules (déprécié 2026-04-29).';