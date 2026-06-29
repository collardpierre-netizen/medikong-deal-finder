
CREATE OR REPLACE FUNCTION public.admin_inspect_table_grants(_schema text DEFAULT 'public', _table text DEFAULT 'vendors')
RETURNS TABLE(grantee text, privilege_type text, is_grantable boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT grantee::text, privilege_type::text, (is_grantable = 'YES')
  FROM information_schema.role_table_grants
  WHERE table_schema = _schema AND table_name = _table
    AND public.is_admin(auth.uid())
  ORDER BY grantee, privilege_type;
$$;

CREATE OR REPLACE FUNCTION public.admin_inspect_table_rls(_schema text DEFAULT 'public', _table text DEFAULT 'vendors')
RETURNS TABLE(rls_enabled boolean, policy_name text, cmd text, roles text[], qual text, with_check text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.relrowsecurity,
    p.polname::text,
    CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
                  WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' ELSE p.polcmd::text END,
    (SELECT array_agg(rolname::text ORDER BY rolname) FROM pg_roles WHERE oid = ANY(p.polroles)),
    pg_get_expr(p.polqual, p.polrelid),
    pg_get_expr(p.polwithcheck, p.polrelid)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE n.nspname = _schema AND c.relname = _table
    AND public.is_admin(auth.uid())
  ORDER BY p.polname;
$$;

REVOKE ALL ON FUNCTION public.admin_inspect_table_grants(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_inspect_table_rls(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_inspect_table_grants(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_inspect_table_rls(text, text) TO authenticated;
