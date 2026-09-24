-- LOT SÉCURITÉ 1 — règles d'affichage vendeurs : lecture directe admin uniquement.
-- Les surfaces publiques passent par resolve_vendor_visibility() qui ne renvoie
-- que (vendor_id, show_real_name) pour le contexte demandé (pays + profil acheteur).
CREATE OR REPLACE FUNCTION public.resolve_vendor_visibility(_vendor_ids uuid[], _country text, _customer_type text)
RETURNS TABLE(vendor_id uuid, show_real_name boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (r.vendor_id) r.vendor_id, r.show_real_name
  FROM public.vendor_visibility_rules r
  WHERE r.vendor_id = ANY(_vendor_ids)
    AND (r.country_code IS NULL OR r.country_code = _country)
    AND (r.customer_type IS NULL OR r.customer_type = _customer_type)
  ORDER BY r.vendor_id, r.priority DESC
$$;
REVOKE ALL ON FUNCTION public.resolve_vendor_visibility(uuid[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_vendor_visibility(uuid[], text, text) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Anon read vendor_visibility_rules" ON public.vendor_visibility_rules;
DROP POLICY IF EXISTS "Authenticated read vendor_visibility_rules" ON public.vendor_visibility_rules;
REVOKE SELECT ON public.vendor_visibility_rules FROM anon;