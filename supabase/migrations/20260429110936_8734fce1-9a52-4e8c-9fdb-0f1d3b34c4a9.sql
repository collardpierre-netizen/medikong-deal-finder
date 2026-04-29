-- 1) products.pack_size : nombre d'unités contenues dans le packaging vendu (4 pour "4x125 ml")
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pack_size integer;

COMMENT ON COLUMN public.products.pack_size IS
  'Nombre d''unites par conditionnement (ex: 4 pour "4x125 ml"). NULL = inconnu, l''UI peut tomber sur une extraction depuis le nom.';

-- 2) external_offers.pack_size_override : si l'offre externe vend un format different (NULL = on prend celui du produit)
ALTER TABLE public.external_offers
  ADD COLUMN IF NOT EXISTS pack_size_override integer;

COMMENT ON COLUMN public.external_offers.pack_size_override IS
  'Override du conditionnement pour cette offre externe (cas ou le vendeur externe vend un pack different du produit canonique). NULL = on utilise products.pack_size.';

-- Contraintes simples : valeurs positives uniquement
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_pack_size_positive;
ALTER TABLE public.products
  ADD CONSTRAINT products_pack_size_positive
  CHECK (pack_size IS NULL OR pack_size > 0);

ALTER TABLE public.external_offers
  DROP CONSTRAINT IF EXISTS external_offers_pack_size_override_positive;
ALTER TABLE public.external_offers
  ADD CONSTRAINT external_offers_pack_size_override_positive
  CHECK (pack_size_override IS NULL OR pack_size_override > 0);

-- 3) RPC helper qui resout le pack effectif pour une offre externe
CREATE OR REPLACE FUNCTION public.resolve_effective_pack_size(_external_offer_id uuid)
RETURNS TABLE(pack_size integer, source text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override integer;
  v_product_pack integer;
BEGIN
  SELECT eo.pack_size_override, p.pack_size
    INTO v_override, v_product_pack
  FROM public.external_offers eo
  JOIN public.products p ON p.id = eo.product_id
  WHERE eo.id = _external_offer_id;

  IF v_override IS NOT NULL AND v_override > 0 THEN
    RETURN QUERY SELECT v_override, 'offer_override'::text;
  ELSIF v_product_pack IS NOT NULL AND v_product_pack > 0 THEN
    RETURN QUERY SELECT v_product_pack, 'product'::text;
  ELSE
    RETURN QUERY SELECT 1, 'fallback'::text;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.resolve_effective_pack_size(uuid) IS
  'Retourne le nombre d''unites par pack pour une offre externe (priorite : override offre > products.pack_size > 1).';

-- Permission d'execution publique : meme regle que resolve_product_vat_rate
GRANT EXECUTE ON FUNCTION public.resolve_effective_pack_size(uuid) TO anon, authenticated;
