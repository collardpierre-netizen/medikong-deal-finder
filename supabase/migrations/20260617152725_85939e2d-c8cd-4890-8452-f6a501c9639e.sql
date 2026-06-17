
-- 1) Nouveau profil acheteur "revendeur_pro"
INSERT INTO public.buyer_profiles (id, label, description, display_order)
VALUES ('revendeur_pro', 'Revendeur professionnel', 'Accès au catalogue B2B inter-vendeurs et aux prix revendeur', 5)
ON CONFLICT (id) DO NOTHING;

-- 2) Rattacher un acheteur à un buyer_profile
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS buyer_profile_id text NULL REFERENCES public.buyer_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_buyer_profile_id ON public.customers(buyer_profile_id) WHERE buyer_profile_id IS NOT NULL;

-- 3) RPC : profil acheteur courant
CREATE OR REPLACE FUNCTION public.current_buyer_profile_id()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT buyer_profile_id
  FROM public.customers
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_buyer_profile_id() TO anon, authenticated;

-- 4) RPC : liste des offres revendeur (catalogue /pro)
CREATE OR REPLACE FUNCTION public.list_reseller_offers(
  _country text DEFAULT NULL,
  _limit int DEFAULT 60,
  _offset int DEFAULT 0
)
RETURNS TABLE(
  offer_id uuid,
  product_id uuid,
  vendor_id uuid,
  price_excl_vat numeric,
  price_source text,
  moq integer,
  mov_amount numeric,
  stock_quantity integer,
  country_code text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text;
BEGIN
  v_profile := public.current_buyer_profile_id();
  IF v_profile IS DISTINCT FROM 'revendeur_pro' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT DISTINCT o.id AS offer_id, o.product_id, o.vendor_id,
           o.price_excl_vat AS base_price,
           o.moq, o.mov_amount, o.stock_quantity, o.country_code
    FROM public.offers o
    JOIN public.products p ON p.id = o.product_id
    JOIN public.vendor_exclusivities e
      ON e.is_active = true
     AND e.mode = 'hide'
     AND now() >= e.valid_from
     AND now() <  e.valid_until
     AND e.vendor_id = o.vendor_id
     AND 'revendeur_pro' = ANY(e.buyer_profile_ids)
     AND (e.country_codes IS NULL OR _country IS NULL OR _country = ANY(e.country_codes))
     AND (
       (e.scope = 'product'      AND e.product_id      = p.id)
       OR (e.scope = 'brand'        AND e.brand_id        = p.brand_id)
       OR (e.scope = 'manufacturer' AND e.manufacturer_id = p.manufacturer_id)
       OR (e.scope = 'category'     AND e.category_id     = p.primary_category_id)
     )
    WHERE o.is_active = true
      AND (_country IS NULL OR o.country_code = _country OR o.country_code IS NULL)
  )
  SELECT
    el.offer_id, el.product_id, el.vendor_id,
    COALESCE(rp.price_excl_vat, el.base_price) AS price_excl_vat,
    COALESCE(rp.source, 'offer_base') AS price_source,
    el.moq, el.mov_amount, el.stock_quantity, el.country_code
  FROM eligible el
  LEFT JOIN LATERAL public.resolve_offer_price_for_profile(el.offer_id, 'revendeur_pro') rp ON true
  ORDER BY el.product_id, price_excl_vat ASC
  LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_reseller_offers(text, int, int) TO authenticated;

-- 5) Masquage public des offres ciblées "hide + buyer_profile"
-- On remplace la policy publique de lecture par une version qui exclut les offres
-- frappées d'une exclusivité 'hide' visant un profil, sauf si l'utilisateur courant
-- porte un des profils ciblés.
DROP POLICY IF EXISTS "Offers read active public" ON public.offers;

CREATE POLICY "Offers read active public"
ON public.offers
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.vendor_exclusivities e
    JOIN public.products p ON p.id = offers.product_id
    WHERE e.is_active = true
      AND e.mode = 'hide'
      AND now() >= e.valid_from
      AND now() <  e.valid_until
      AND e.vendor_id = offers.vendor_id
      AND e.buyer_profile_ids IS NOT NULL
      AND array_length(e.buyer_profile_ids, 1) > 0
      AND (
        public.current_buyer_profile_id() IS NULL
        OR NOT (public.current_buyer_profile_id() = ANY(e.buyer_profile_ids))
      )
      AND (
        (e.scope = 'product'      AND e.product_id      = p.id)
        OR (e.scope = 'brand'        AND e.brand_id        = p.brand_id)
        OR (e.scope = 'manufacturer' AND e.manufacturer_id = p.manufacturer_id)
        OR (e.scope = 'category'     AND e.category_id     = p.primary_category_id)
      )
  )
);
