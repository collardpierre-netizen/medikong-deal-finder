
DROP FUNCTION IF EXISTS public.admin_blocked_offers_list();

CREATE OR REPLACE FUNCTION public.admin_blocked_offers_list()
RETURNS TABLE (
  offer_id uuid,
  vendor_id uuid,
  vendor_name text,
  vendor_display_code text,
  product_id uuid,
  product_name text,
  product_gtin text,
  brand_id uuid,
  brand_name text,
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
    o.id, v.id, v.name, v.display_code,
    p.id, p.name, p.gtin,
    b.id, b.name,
    o.is_active, o.updated_at,
    (COALESCE(v.is_authorized_distributor, false) = false),
    (v.mandate_signed_at IS NULL),
    COALESCE(v.is_authorized_distributor, false),
    v.mandate_signed_at,
    CASE
      WHEN COALESCE(v.is_authorized_distributor, false) = false AND v.mandate_signed_at IS NULL
        THEN 'Distributeur non autorisé + mandat non signé'
      WHEN COALESCE(v.is_authorized_distributor, false) = false
        THEN 'Vendeur non déclaré distributeur autorisé'
      WHEN v.mandate_signed_at IS NULL
        THEN 'Mandat de facturation non signé'
      ELSE 'Conforme'
    END
  FROM public.offers o
  JOIN public.vendors v ON v.id = o.vendor_id
  LEFT JOIN public.products p ON p.id = o.product_id
  LEFT JOIN public.brands b ON b.id = p.brand_id
  WHERE o.is_active = false
    AND v.name <> 'Balooh'
    AND (COALESCE(v.is_authorized_distributor, false) = false OR v.mandate_signed_at IS NULL)
  ORDER BY o.updated_at DESC NULLS LAST
  LIMIT 1000;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_blocked_offers_list() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_blocked_offers_list() TO authenticated, service_role;
