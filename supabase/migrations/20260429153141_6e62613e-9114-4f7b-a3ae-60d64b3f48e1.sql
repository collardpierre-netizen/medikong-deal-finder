-- 1) Permettre les deux modes (absolu OU delta %) sur les prix par profil d'une offre
ALTER TABLE public.offer_buyer_profile_prices
  ALTER COLUMN price_excl_vat DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS discount_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'absolute',
  ADD CONSTRAINT obpp_pricing_mode_chk CHECK (pricing_mode IN ('absolute','discount_pct')),
  ADD CONSTRAINT obpp_value_consistency_chk CHECK (
    (pricing_mode = 'absolute' AND price_excl_vat IS NOT NULL AND discount_pct IS NULL)
    OR (pricing_mode = 'discount_pct' AND discount_pct IS NOT NULL AND price_excl_vat IS NULL)
  ),
  ADD CONSTRAINT obpp_discount_range_chk CHECK (discount_pct IS NULL OR (discount_pct >= -100 AND discount_pct <= 100));

-- 2) Étendre vendor_profile_defaults avec un défaut prix par profil (absolu ou %)
ALTER TABLE public.vendor_profile_defaults
  ADD COLUMN IF NOT EXISTS default_price_excl_vat numeric(12,4),
  ADD COLUMN IF NOT EXISTS default_discount_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS default_pricing_mode text,
  ADD CONSTRAINT vpd_pricing_mode_chk CHECK (
    default_pricing_mode IS NULL OR default_pricing_mode IN ('absolute','discount_pct')
  ),
  ADD CONSTRAINT vpd_default_discount_range_chk CHECK (
    default_discount_pct IS NULL OR (default_discount_pct >= -100 AND default_discount_pct <= 100)
  );

-- 3) RPC de résolution : retourne le prix HTVA effectif pour une offre + un profil acheteur
--    Cascade : override offre absolu > override offre % > défaut vendeur absolu > défaut vendeur % > prix de base offre
CREATE OR REPLACE FUNCTION public.resolve_offer_price_for_profile(
  _offer_id uuid,
  _buyer_profile_id text
)
RETURNS TABLE (
  price_excl_vat numeric,
  source text  -- 'offer_absolute' | 'offer_discount' | 'vendor_default_absolute' | 'vendor_default_discount' | 'offer_base'
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_price numeric;
  v_vendor_id uuid;
  v_profile_country text;
  override_row record;
  default_row record;
BEGIN
  SELECT o.price_excl_vat, o.vendor_id
    INTO base_price, v_vendor_id
  FROM public.offers o
  WHERE o.id = _offer_id;

  IF base_price IS NULL THEN
    RETURN;
  END IF;

  -- A) Override au niveau offre
  SELECT obpp.pricing_mode, obpp.price_excl_vat, obpp.discount_pct
    INTO override_row
  FROM public.offer_buyer_profile_prices obpp
  WHERE obpp.offer_id = _offer_id AND obpp.buyer_profile_id = _buyer_profile_id
  LIMIT 1;

  IF override_row.pricing_mode = 'absolute' THEN
    RETURN QUERY SELECT override_row.price_excl_vat, 'offer_absolute'::text;
    RETURN;
  ELSIF override_row.pricing_mode = 'discount_pct' THEN
    RETURN QUERY SELECT ROUND(base_price * (1 - override_row.discount_pct / 100.0), 4), 'offer_discount'::text;
    RETURN;
  END IF;

  -- B) Défaut vendeur (on prend la première règle vendeur pour ce profil, peu importe le pays — ou BE par défaut)
  SELECT vpd.default_pricing_mode, vpd.default_price_excl_vat, vpd.default_discount_pct
    INTO default_row
  FROM public.vendor_profile_defaults vpd
  WHERE vpd.vendor_id = v_vendor_id
    AND vpd.profile_type = _buyer_profile_id
    AND vpd.default_pricing_mode IS NOT NULL
  ORDER BY (vpd.country_code = 'BE') DESC, vpd.country_code ASC
  LIMIT 1;

  IF default_row.default_pricing_mode = 'absolute' AND default_row.default_price_excl_vat IS NOT NULL THEN
    RETURN QUERY SELECT default_row.default_price_excl_vat, 'vendor_default_absolute'::text;
    RETURN;
  ELSIF default_row.default_pricing_mode = 'discount_pct' AND default_row.default_discount_pct IS NOT NULL THEN
    RETURN QUERY SELECT ROUND(base_price * (1 - default_row.default_discount_pct / 100.0), 4), 'vendor_default_discount'::text;
    RETURN;
  END IF;

  -- C) Fallback : prix de base de l'offre
  RETURN QUERY SELECT base_price, 'offer_base'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_offer_price_for_profile(uuid, text) TO anon, authenticated;