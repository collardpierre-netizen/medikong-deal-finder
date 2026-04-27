-- Fonctions RPC publiques pour les compteurs de la home
-- (les tables offers/vendors restent protégées par RLS pour les SELECT directs)

CREATE OR REPLACE FUNCTION public.public_active_offers_count(_country_code text DEFAULT 'BE')
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.offers
  WHERE is_active = true
    AND country_code = _country_code;
$$;

CREATE OR REPLACE FUNCTION public.public_verified_vendors_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.vendors
  WHERE is_active = true
    AND is_verified = true;
$$;

-- Autoriser l'exécution publique (anon + authenticated)
GRANT EXECUTE ON FUNCTION public.public_active_offers_count(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_verified_vendors_count() TO anon, authenticated;