-- Fonction d'audit des tables de backup
CREATE OR REPLACE FUNCTION public.audit_backup_tables_rls()
RETURNS TABLE(
  table_name text,
  rls_enabled boolean,
  policy_count integer,
  anon_has_grants boolean,
  authenticated_has_grants boolean,
  status text,
  issues text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_super_admin(v_user) THEN
    RAISE EXCEPTION 'Réservé aux super_admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH backup_tables AS (
    SELECT c.oid, c.relname::text AS tname, c.relrowsecurity AS rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname ~ '_backup(_|$)'
  ),
  policies AS (
    SELECT schemaname, tablename, COUNT(*)::int AS pc
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename
  ),
  grants AS (
    SELECT
      table_name AS tname,
      bool_or(grantee = 'anon') AS anon_g,
      bool_or(grantee = 'authenticated') AS auth_g
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated')
    GROUP BY table_name
  )
  SELECT
    bt.tname,
    bt.rls,
    COALESCE(p.pc, 0),
    COALESCE(g.anon_g, false),
    COALESCE(g.auth_g, false),
    CASE
      WHEN NOT bt.rls THEN 'fail'
      WHEN COALESCE(g.anon_g, false) OR COALESCE(g.auth_g, false) THEN 'fail'
      WHEN COALESCE(p.pc, 0) = 0 THEN 'ok'  -- RLS on + no policy = personne ne peut lire (sauf service_role)
      ELSE 'warn'  -- policies présentes : à revoir manuellement
    END AS status,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN NOT bt.rls THEN 'RLS désactivée' END,
      CASE WHEN COALESCE(g.anon_g, false) THEN 'Permissions GRANT pour anon' END,
      CASE WHEN COALESCE(g.auth_g, false) THEN 'Permissions GRANT pour authenticated' END,
      CASE WHEN COALESCE(p.pc, 0) > 0 THEN format('%s policy(ies) à auditer manuellement', p.pc) END
    ], NULL)
  FROM backup_tables bt
  LEFT JOIN policies p ON p.tablename = bt.tname
  LEFT JOIN grants g ON g.tname = bt.tname
  ORDER BY
    CASE
      WHEN NOT bt.rls THEN 0
      WHEN COALESCE(g.anon_g, false) OR COALESCE(g.auth_g, false) THEN 0
      ELSE 1
    END,
    bt.tname;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_backup_tables_rls() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_backup_tables_rls() TO authenticated;