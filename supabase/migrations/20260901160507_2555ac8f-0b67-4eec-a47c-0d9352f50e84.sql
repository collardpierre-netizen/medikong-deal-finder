CREATE OR REPLACE FUNCTION public.affiliate_admin_attachable_customers(_q text DEFAULT NULL)
RETURNS TABLE(customer_id uuid, auth_user_id uuid, label text, email text, company_name text, orders_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN QUERY
  SELECT c.id,
         c.auth_user_id,
         COALESCE(NULLIF(c.company_name, ''), c.email, c.id::text)::text,
         c.email::text,
         c.company_name::text,
         (SELECT COUNT(*)::int FROM public.orders o WHERE o.customer_id = c.id)
  FROM public.customers c
  WHERE c.auth_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.affiliate_referrals r
      WHERE r.user_id = c.auth_user_id AND r.status <> 'revoked')
    AND (_q IS NULL OR _q = '' OR
         c.company_name ILIKE '%' || _q || '%' OR
         c.email ILIKE '%' || _q || '%')
  ORDER BY 3
  LIMIT 50;
END;
$$;