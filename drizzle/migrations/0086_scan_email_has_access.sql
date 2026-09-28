CREATE OR REPLACE FUNCTION public.scan_email_has_access(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce((SELECT scan_enabled FROM site_config WHERE id = 1), false)
    AND EXISTS (
      SELECT 1 FROM auth.users u
      JOIN customers c ON c.scan_enabled IS TRUE AND (
        c.auth_user_id = u.id OR EXISTS (
          SELECT 1 FROM account_memberships m WHERE m.user_id = u.id AND m.account_id = c.id
            AND m.account_kind = 'buyer' AND m.status = 'active'))
      WHERE lower(u.email) = lower(trim(_email))
    );
$$;
REVOKE ALL ON FUNCTION public.scan_email_has_access(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_email_has_access(text) TO service_role;