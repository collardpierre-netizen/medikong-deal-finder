
-- Admin RPC: list pending invitations across all vendors/buyers
CREATE OR REPLACE FUNCTION public.admin_list_pending_invitations()
RETURNS TABLE (
  id uuid,
  account_kind text,
  account_id uuid,
  account_name text,
  email text,
  role text,
  join_code text,
  expires_at timestamptz,
  created_at timestamptz,
  created_by uuid,
  invited_by_name text,
  is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    inv.id,
    inv.account_kind,
    inv.account_id,
    CASE
      WHEN inv.account_kind = 'vendor' THEN COALESCE(v.company_name, v.name, '—')
      WHEN inv.account_kind = 'buyer'  THEN COALESCE(b.company_name, b.name, '—')
      ELSE '—'
    END AS account_name,
    inv.email,
    inv.role,
    inv.join_code,
    inv.expires_at,
    inv.created_at,
    inv.created_by,
    p.full_name AS invited_by_name,
    (inv.expires_at < now()) AS is_expired
  FROM public.account_invitations inv
  LEFT JOIN public.vendors v ON inv.account_kind = 'vendor' AND v.id = inv.account_id
  LEFT JOIN public.buyers  b ON inv.account_kind = 'buyer'  AND b.id = inv.account_id
  LEFT JOIN public.profiles p ON p.id = inv.created_by
  WHERE inv.accepted_at IS NULL AND inv.revoked_at IS NULL
  ORDER BY inv.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_pending_invitations() TO authenticated;

-- Admin RPC: regenerate token for an existing pending email invitation
-- (rotates token_hash, refreshes expires_at 14 days, keeps same row)
CREATE OR REPLACE FUNCTION public.admin_resend_invitation(_invitation_id uuid)
RETURNS TABLE(token text, email text, account_kind text, account_id uuid, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.account_invitations%ROWTYPE;
  v_token text;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_inv FROM public.account_invitations WHERE id = _invitation_id;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'already accepted';
  END IF;
  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'revoked';
  END IF;
  IF v_inv.email IS NULL THEN
    RAISE EXCEPTION 'not an email invitation';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  UPDATE public.account_invitations
  SET token_hash = _account_hash_token(v_token),
      expires_at = now() + interval '14 days'
  WHERE id = _invitation_id;

  token := v_token;
  email := v_inv.email;
  account_kind := v_inv.account_kind;
  account_id := v_inv.account_id;
  role := v_inv.role;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resend_invitation(uuid) TO authenticated;
