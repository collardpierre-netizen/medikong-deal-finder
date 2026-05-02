CREATE OR REPLACE FUNCTION public.list_admin_users()
RETURNS TABLE(user_id uuid, email text, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    ur.user_id,
    u.email::text,
    COALESCE(NULLIF(p.display_name, ''), u.email::text) AS display_name
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('admin','super_admin','moderator')
  ORDER BY display_name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admin_users() TO authenticated, service_role;