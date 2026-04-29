-- ============================================================
-- Vue unifiée : prix effectif par (offre × profil acheteur)
-- ============================================================
-- Cascade reproduite ici (cohérente avec resolvePriceCascade côté front) :
--   1. Override par profil via offer_buyer_profile_prices (absolu OU %)
--   2. Override par défaut vendeur via vendor_profile_defaults (absolu OU %)
--   3. Fallback legacy product_prices × price_levels (mappé via price_levels.code = buyer_profile_id)
--   4. Prix de base de l'offre (offers.price_excl_vat)
--
-- security_invoker = true → respecte la RLS des tables sources (offers est public,
-- offer_buyer_profile_prices reste privé au vendeur côté écriture mais lisible
-- pour la résolution de prix par la fonction RPC existante).

CREATE OR REPLACE VIEW public.effective_offer_prices_v
WITH (security_invoker = true) AS
WITH active_offers AS (
  SELECT o.id AS offer_id,
         o.vendor_id,
         o.product_id,
         o.price_excl_vat AS base_price_excl_vat,
         o.price_incl_vat AS base_price_incl_vat,
         CASE
           WHEN o.price_excl_vat > 0 AND o.price_incl_vat > 0
             THEN o.price_incl_vat / o.price_excl_vat
           ELSE 1
         END AS vat_ratio
  FROM public.offers o
  WHERE o.is_active = true
),
profile_axis AS (
  -- Produit cartésien (offres actives × profils acheteurs) :
  -- la vue expose une ligne par combinaison, avec le prix effectif résolu.
  SELECT ao.*, bp.id AS buyer_profile_id
  FROM active_offers ao
  CROSS JOIN public.buyer_profiles bp
),
legacy_level_prices AS (
  -- Map product_id × price_levels.code → prix legacy.
  -- On joint sur code = buyer_profile_id (les codes legacy 'pharmacien', 'grossiste'
  -- ont été repris comme buyer_profile_id pour la transition).
  SELECT pp.product_id,
         pl.code AS profile_code,
         pp.price::numeric(12,4) AS legacy_price_excl_vat
  FROM public.product_prices pp
  JOIN public.price_levels pl ON pl.id = pp.price_level_id
)
SELECT
  pa.offer_id,
  pa.vendor_id,
  pa.product_id,
  pa.buyer_profile_id,
  pa.base_price_excl_vat,
  pa.base_price_incl_vat,
  -- Prix résolu HTVA via la cascade DB
  COALESCE(
    -- 1. Override RPC (offer_buyer_profile_prices + vendor_profile_defaults)
    (SELECT (rp).price_excl_vat
     FROM public.resolve_offer_price_for_profile(pa.offer_id, pa.buyer_profile_id) rp
     WHERE (rp).source <> 'offer_base'
     LIMIT 1),
    -- 2. Fallback legacy product_prices
    (SELECT llp.legacy_price_excl_vat
     FROM legacy_level_prices llp
     WHERE llp.product_id = pa.product_id
       AND llp.profile_code = pa.buyer_profile_id),
    -- 3. Prix de base
    pa.base_price_excl_vat
  )::numeric(12,4) AS effective_price_excl_vat,
  -- TVAC recalculé via le ratio de l'offre
  CASE
    WHEN pa.vat_ratio = 1 THEN pa.base_price_incl_vat
    ELSE ROUND(
      COALESCE(
        (SELECT (rp).price_excl_vat
         FROM public.resolve_offer_price_for_profile(pa.offer_id, pa.buyer_profile_id) rp
         WHERE (rp).source <> 'offer_base'
         LIMIT 1),
        (SELECT llp.legacy_price_excl_vat
         FROM legacy_level_prices llp
         WHERE llp.product_id = pa.product_id
           AND llp.profile_code = pa.buyer_profile_id),
        pa.base_price_excl_vat
      ) * pa.vat_ratio,
      2
    )
  END::numeric(12,4) AS effective_price_incl_vat,
  -- Source du prix résolu : offer_absolute / offer_discount /
  -- vendor_default_absolute / vendor_default_discount / legacy_level / offer_base
  COALESCE(
    (SELECT (rp).source
     FROM public.resolve_offer_price_for_profile(pa.offer_id, pa.buyer_profile_id) rp
     WHERE (rp).source <> 'offer_base'
     LIMIT 1),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM legacy_level_prices llp
        WHERE llp.product_id = pa.product_id
          AND llp.profile_code = pa.buyer_profile_id
      ) THEN 'legacy_level'
      ELSE 'offer_base'
    END
  ) AS price_source
FROM profile_axis pa;

COMMENT ON VIEW public.effective_offer_prices_v IS
  'Vue unifiée des prix effectifs HTVA/TVAC par (offre × profil acheteur). '
  'Cascade : override profil > override vendeur > legacy product_prices > prix de base offre. '
  'Source de vérité unique pour admin / vendeur / acheteur. security_invoker = true.';

-- Lecture publique alignée sur la policy "public select" de offers (les prix
-- restent masqués côté UI tant que l'utilisateur n'est pas verified buyer).
GRANT SELECT ON public.effective_offer_prices_v TO anon, authenticated;

-- ============================================================
-- Fonction de lecture : un seul couple (offre, profil) à la fois
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_effective_offer_price(
  _offer_id uuid,
  _buyer_profile_id text
)
RETURNS TABLE(
  offer_id uuid,
  vendor_id uuid,
  product_id uuid,
  buyer_profile_id text,
  effective_price_excl_vat numeric,
  effective_price_incl_vat numeric,
  base_price_excl_vat numeric,
  base_price_incl_vat numeric,
  price_source text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT v.offer_id,
         v.vendor_id,
         v.product_id,
         v.buyer_profile_id,
         v.effective_price_excl_vat,
         v.effective_price_incl_vat,
         v.base_price_excl_vat,
         v.base_price_incl_vat,
         v.price_source
  FROM public.effective_offer_prices_v v
  WHERE v.offer_id = _offer_id
    AND v.buyer_profile_id = _buyer_profile_id;
$$;

COMMENT ON FUNCTION public.get_effective_offer_price(uuid, text) IS
  'Renvoie le prix effectif HTVA/TVAC d''une offre pour un profil acheteur donné, '
  'incluant la source de la résolution. Wrapper sur effective_offer_prices_v.';

GRANT EXECUTE ON FUNCTION public.get_effective_offer_price(uuid, text) TO anon, authenticated;

-- ============================================================
-- Marqueur de dépréciation sur la table legacy
-- ============================================================
COMMENT ON TABLE public.product_prices IS
  'DEPRECATED — remplacé par offer_buyer_profile_prices + vendor_profile_defaults. '
  'Conservé en lecture pour compat (cascade dans effective_offer_prices_v). '
  'Aucune nouvelle écriture ne devrait être faite ici. À supprimer après migration complète.';