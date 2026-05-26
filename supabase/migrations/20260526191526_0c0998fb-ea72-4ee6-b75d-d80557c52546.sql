
CREATE OR REPLACE FUNCTION public.offer_exclusivity_flags(
  p_product_id uuid,
  p_vendor_id uuid,
  p_country_code text DEFAULT NULL
)
RETURNS TABLE(
  is_hidden boolean,
  is_showcase_dimmed boolean,
  is_blocked boolean,
  exclusive_vendor_id uuid,
  exclusivity_mode vendor_exclusivity_mode,
  exclusivity_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_excl record;
BEGIN
  SELECT r.exclusive_vendor_id, r.mode, r.exclusivity_id
    INTO v_excl
  FROM public.resolve_offer_exclusivity(p_product_id, p_country_code) r
  LIMIT 1;

  IF v_excl.exclusivity_id IS NULL THEN
    RETURN QUERY SELECT false, false, false, NULL::uuid, NULL::vendor_exclusivity_mode, NULL::uuid;
    RETURN;
  END IF;

  IF p_vendor_id IS NOT NULL AND v_excl.exclusive_vendor_id = p_vendor_id THEN
    RETURN QUERY SELECT false, false, false, v_excl.exclusive_vendor_id, v_excl.mode, v_excl.exclusivity_id;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    (v_excl.mode = 'hide'),
    (v_excl.mode = 'showcase'),
    (v_excl.mode = 'block'),
    v_excl.exclusive_vendor_id,
    v_excl.mode,
    v_excl.exclusivity_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.offer_exclusivity_flags(uuid, uuid, text) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.offers_with_exclusivity_v
WITH (security_invoker = true)
AS
SELECT
  o.id AS offer_id,
  o.product_id,
  o.vendor_id,
  o.is_active,
  f.is_hidden,
  f.is_showcase_dimmed,
  f.is_blocked,
  f.exclusive_vendor_id,
  f.exclusivity_mode,
  f.exclusivity_id
FROM public.offers o
CROSS JOIN LATERAL public.offer_exclusivity_flags(o.product_id, o.vendor_id, NULL) f;

GRANT SELECT ON public.offers_with_exclusivity_v TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.external_offers_with_exclusivity_v
WITH (security_invoker = true)
AS
SELECT
  eo.id AS external_offer_id,
  eo.product_id,
  eo.external_vendor_id,
  eo.is_active,
  f.is_hidden,
  f.is_showcase_dimmed,
  f.is_blocked,
  f.exclusive_vendor_id,
  f.exclusivity_mode,
  f.exclusivity_id
FROM public.external_offers eo
CROSS JOIN LATERAL public.offer_exclusivity_flags(eo.product_id, NULL::uuid, NULL) f;

GRANT SELECT ON public.external_offers_with_exclusivity_v TO anon, authenticated, service_role;
