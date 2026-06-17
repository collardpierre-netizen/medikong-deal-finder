CREATE OR REPLACE FUNCTION public.buyer_p2p_get_contact(_listing_id uuid, _role text)
RETURNS TABLE(email text, pharmacy_name text, buyer_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing record;
  v_target_buyer uuid;
  v_my_buyers uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _role NOT IN ('seller','target') THEN RAISE EXCEPTION 'invalid role'; END IF;

  SELECT * INTO v_listing FROM public.buyer_p2p_listings WHERE id = _listing_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'listing not found'; END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_my_buyers
  FROM public.buyers WHERE user_id = v_uid AND is_active = true;

  IF NOT (
    v_listing.seller_buyer_id = ANY(v_my_buyers)
    OR v_listing.target_buyer_id = ANY(v_my_buyers)
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_target_buyer := CASE WHEN _role = 'seller' THEN v_listing.seller_buyer_id ELSE v_listing.target_buyer_id END;

  RETURN QUERY
  SELECT u.email::text, b.pharmacy_name, b.id
  FROM public.buyers b
  JOIN auth.users u ON u.id = b.user_id
  WHERE b.id = v_target_buyer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buyer_p2p_get_contact(uuid, text) TO authenticated;