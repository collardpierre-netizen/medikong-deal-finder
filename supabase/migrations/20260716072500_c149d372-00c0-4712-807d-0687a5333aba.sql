
CREATE OR REPLACE FUNCTION public.admin_blocked_offers_list()
RETURNS TABLE (
  offer_id uuid,
  vendor_id uuid,
  vendor_name text,
  vendor_display_code text,
  product_id uuid,
  product_name text,
  product_gtin text,
  is_active boolean,
  updated_at timestamptz,
  missing_distributor boolean,
  missing_mandate boolean,
  is_authorized_distributor boolean,
  mandate_signed_at timestamptz,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    o.id AS offer_id,
    v.id AS vendor_id,
    v.name AS vendor_name,
    v.display_code AS vendor_display_code,
    p.id AS product_id,
    p.name AS product_name,
    p.gtin AS product_gtin,
    o.is_active,
    o.updated_at,
    (COALESCE(v.is_authorized_distributor, false) = false) AS missing_distributor,
    (v.mandate_signed_at IS NULL) AS missing_mandate,
    COALESCE(v.is_authorized_distributor, false) AS is_authorized_distributor,
    v.mandate_signed_at,
    CASE
      WHEN COALESCE(v.is_authorized_distributor, false) = false AND v.mandate_signed_at IS NULL
        THEN 'Distributeur non autorisé + mandat non signé'
      WHEN COALESCE(v.is_authorized_distributor, false) = false
        THEN 'Vendeur non déclaré distributeur autorisé'
      WHEN v.mandate_signed_at IS NULL
        THEN 'Mandat de facturation non signé'
      ELSE 'Conforme'
    END AS reason
  FROM public.offers o
  JOIN public.vendors v ON v.id = o.vendor_id
  LEFT JOIN public.products p ON p.id = o.product_id
  WHERE o.is_active = false
    AND v.name <> 'Balooh'
    AND (COALESCE(v.is_authorized_distributor, false) = false OR v.mandate_signed_at IS NULL)
  ORDER BY o.updated_at DESC NULLS LAST
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_blocked_offers_list() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_blocked_offers_list() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_recheck_offer_publication(_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id uuid;
  v_auth boolean;
  v_mandate timestamptz;
  v_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT o.vendor_id INTO v_vendor_id
    FROM public.offers o WHERE o.id = _offer_id;

  IF v_vendor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Offre introuvable');
  END IF;

  SELECT name, COALESCE(is_authorized_distributor, false), mandate_signed_at
    INTO v_name, v_auth, v_mandate
    FROM public.vendors WHERE id = v_vendor_id;

  IF v_name = 'Balooh' THEN
    UPDATE public.offers SET is_active = true, updated_at = now() WHERE id = _offer_id;
    RETURN jsonb_build_object('ok', true, 'activated', true, 'reason', 'Vendeur interne (Balooh)');
  END IF;

  IF v_auth = false OR v_mandate IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'activated', false,
      'is_authorized_distributor', v_auth,
      'billing_mandate_signed', (v_mandate IS NOT NULL),
      'reason',
      CASE
        WHEN v_auth = false AND v_mandate IS NULL THEN 'Distributeur non autorisé + mandat non signé'
        WHEN v_auth = false THEN 'Vendeur non déclaré distributeur autorisé'
        ELSE 'Mandat de facturation non signé'
      END
    );
  END IF;

  UPDATE public.offers SET is_active = true, updated_at = now() WHERE id = _offer_id;

  RETURN jsonb_build_object('ok', true, 'activated', true, 'reason', 'Offre republiée');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recheck_offer_publication(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_recheck_offer_publication(uuid) TO authenticated, service_role;
