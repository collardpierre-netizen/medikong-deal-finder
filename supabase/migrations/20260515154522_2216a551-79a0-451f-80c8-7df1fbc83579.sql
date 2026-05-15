
CREATE OR REPLACE FUNCTION public.calculate_offer_price_for_quantity(
  p_offer_id uuid,
  p_quantity integer
)
RETURNS TABLE (
  tier_index integer,
  mov_threshold numeric,
  price_excl_vat numeric,
  price_incl_vat numeric,
  total_excl_vat numeric,
  total_incl_vat numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_price_excl numeric;
  v_base_price_incl numeric;
BEGIN
  SELECT o.price_excl_vat, o.price_incl_vat
  INTO v_base_price_excl, v_base_price_incl
  FROM offers o
  WHERE o.id = p_offer_id AND o.is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
    WITH applicable_tiers AS (
      SELECT
        opt.tier_index,
        opt.mov_threshold,
        opt.price_excl_vat,
        opt.price_incl_vat
      FROM offer_price_tiers opt
      WHERE opt.offer_id = p_offer_id
        AND opt.is_active = true
        AND (p_quantity * opt.price_excl_vat) >= opt.mov_threshold
      ORDER BY opt.mov_threshold DESC
      LIMIT 1
    )
    SELECT
      at.tier_index,
      at.mov_threshold,
      at.price_excl_vat,
      at.price_incl_vat,
      (p_quantity * at.price_excl_vat)::numeric AS total_excl_vat,
      (p_quantity * at.price_incl_vat)::numeric AS total_incl_vat
    FROM applicable_tiers at;

  IF NOT FOUND THEN
    RETURN QUERY
      SELECT
        0 AS tier_index,
        0::numeric AS mov_threshold,
        v_base_price_excl,
        v_base_price_incl,
        (p_quantity * v_base_price_excl)::numeric AS total_excl_vat,
        (p_quantity * v_base_price_incl)::numeric AS total_incl_vat;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_offer_price_for_quantity(uuid, integer) TO authenticated, anon, service_role;
