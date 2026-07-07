CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.is_admin(auth.uid()), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;