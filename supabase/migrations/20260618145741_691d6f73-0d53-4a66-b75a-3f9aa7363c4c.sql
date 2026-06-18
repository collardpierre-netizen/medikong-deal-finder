CREATE OR REPLACE FUNCTION public.account_get_invitation_by_token(_token text)
RETURNS TABLE (
  email text,
  account_kind text,
  role text,
  expires_at timestamptz,
  accepted boolean,
  revoked boolean,
  expired boolean,
  user_exists boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  IF _token IS NULL OR length(_token) = 0 THEN
    RETURN;
  END IF;

  SELECT i.email, i.account_kind::text AS account_kind, i.role::text AS role,
         i.expires_at, i.accepted_at, i.revoked_at
    INTO inv
  FROM public.account_invitations i
  WHERE i.token = _token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    inv.email,
    inv.account_kind,
    inv.role,
    inv.expires_at,
    (inv.accepted_at IS NOT NULL) AS accepted,
    (inv.revoked_at IS NOT NULL) AS revoked,
    (inv.expires_at IS NOT NULL AND inv.expires_at < now()) AS expired,
    EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(inv.email)) AS user_exists;
END;
$$;

REVOKE ALL ON FUNCTION public.account_get_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_get_invitation_by_token(text) TO anon, authenticated, service_role;