
-- =========================================================================
-- 1. TABLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.account_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_kind text NOT NULL CHECK (account_kind IN ('buyer','vendor')),
  account_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','revoked')),
  invited_email text,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_kind, account_id)
);

CREATE INDEX IF NOT EXISTS idx_account_memberships_account
  ON public.account_memberships (account_kind, account_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_account_memberships_user
  ON public.account_memberships (user_id) WHERE status = 'active';

CREATE TRIGGER trg_account_memberships_updated_at
  BEFORE UPDATE ON public.account_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.account_memberships ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.account_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_kind text NOT NULL CHECK (account_kind IN ('buyer','vendor')),
  account_id uuid NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  token_hash text,
  join_code text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (token_hash IS NOT NULL OR join_code IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_invitations_token
  ON public.account_invitations (token_hash) WHERE token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_invitations_join_code_active
  ON public.account_invitations (join_code)
  WHERE join_code IS NOT NULL AND accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_account_invitations_account
  ON public.account_invitations (account_kind, account_id);

ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;


-- =========================================================================
-- 2. HELPERS (SECURITY DEFINER, search_path lock)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.current_user_buyer_account_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT account_id FROM public.account_memberships
   WHERE user_id = auth.uid()
     AND account_kind = 'buyer'
     AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.current_user_vendor_account_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT account_id FROM public.account_memberships
   WHERE user_id = auth.uid()
     AND account_kind = 'vendor'
     AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_account_admin(_kind text, _account_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_memberships
     WHERE user_id = auth.uid()
       AND account_kind = _kind
       AND account_id = _account_id
       AND status = 'active'
       AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.account_has_other_admin(_kind text, _account_id uuid, _excluding_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_memberships
     WHERE account_kind = _kind
       AND account_id = _account_id
       AND status = 'active'
       AND role = 'admin'
       AND user_id <> _excluding_user
  );
$$;


-- =========================================================================
-- 3. RLS POLICIES (membership + invitation)
-- =========================================================================

-- account_memberships
CREATE POLICY "members_select_own_or_admin"
  ON public.account_memberships FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_account_admin(account_kind, account_id)
    OR is_admin(auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "members_admin_modify"
  ON public.account_memberships FOR UPDATE
  TO authenticated
  USING (
    is_account_admin(account_kind, account_id)
    OR is_admin(auth.uid())
  );

CREATE POLICY "members_admin_delete"
  ON public.account_memberships FOR DELETE
  TO authenticated
  USING (
    is_account_admin(account_kind, account_id)
    OR is_admin(auth.uid())
  );

-- No public INSERT: handled via RPC SECURITY DEFINER

-- account_invitations: only admins of account can read/list
CREATE POLICY "invites_admin_select"
  ON public.account_invitations FOR SELECT
  TO authenticated
  USING (
    is_account_admin(account_kind, account_id)
    OR is_admin(auth.uid())
  );

-- No INSERT/UPDATE/DELETE policies: all via RPCs


-- =========================================================================
-- 4. EXTEND profiles + vendors RLS (membership-aware)
-- =========================================================================

-- profiles: allow members of the buyer account to read it
CREATE POLICY "profiles_members_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR id IN (SELECT current_user_buyer_account_ids())
  );

-- profiles: allow admins of the buyer account to update (additive to existing "own profile" policy)
CREATE POLICY "profiles_admins_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (is_account_admin('buyer', id));

-- vendors: allow members to read their vendor row (additive)
CREATE POLICY "vendors_members_select"
  ON public.vendors FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR id IN (SELECT current_user_vendor_account_ids())
  );

CREATE POLICY "vendors_admins_update"
  ON public.vendors FOR UPDATE
  TO authenticated
  USING (is_account_admin('vendor', id));


-- =========================================================================
-- 5. BACKFILL (idempotent)
-- =========================================================================

INSERT INTO public.account_memberships (user_id, account_kind, account_id, role, status, accepted_at)
SELECT p.user_id, 'buyer', p.id, 'admin', 'active', p.created_at
  FROM public.profiles p
 WHERE p.user_id IS NOT NULL
ON CONFLICT (user_id, account_kind, account_id) DO NOTHING;

INSERT INTO public.account_memberships (user_id, account_kind, account_id, role, status, accepted_at)
SELECT v.auth_user_id, 'vendor', v.id, 'admin', 'active', v.created_at
  FROM public.vendors v
 WHERE v.auth_user_id IS NOT NULL
ON CONFLICT (user_id, account_kind, account_id) DO NOTHING;


-- =========================================================================
-- 6. RPCs — invitations & membership management
-- =========================================================================

-- Hash helper (sha256 hex)
CREATE OR REPLACE FUNCTION public._account_hash_token(_token text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT encode(digest(_token, 'sha256'), 'hex');
$$;

-- Invite by email -> returns token (caller must email it). Token shown ONCE.
CREATE OR REPLACE FUNCTION public.account_invite_by_email(
  _kind text,
  _account_id uuid,
  _email text,
  _role text DEFAULT 'member'
)
RETURNS TABLE (invitation_id uuid, token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token text;
  v_id uuid;
BEGIN
  IF NOT (is_account_admin(_kind, _account_id) OR is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _role NOT IN ('admin','member') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;
  IF _email IS NULL OR _email = '' THEN
    RAISE EXCEPTION 'email required';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO public.account_invitations (account_kind, account_id, email, role, token_hash, created_by)
  VALUES (_kind, _account_id, lower(_email), _role, _account_hash_token(v_token), auth.uid())
  RETURNING id INTO v_id;

  invitation_id := v_id;
  token := v_token;
  RETURN NEXT;
END;
$$;

-- Generate a join code (6 chars alphanumeric, upper)
CREATE OR REPLACE FUNCTION public.account_create_join_code(
  _kind text,
  _account_id uuid,
  _role text DEFAULT 'member'
)
RETURNS TABLE (invitation_id uuid, join_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code text;
  v_id uuid;
  v_try int := 0;
BEGIN
  IF NOT (is_account_admin(_kind, _account_id) OR is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _role NOT IN ('admin','member') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  LOOP
    v_try := v_try + 1;
    v_code := upper(substr(translate(encode(gen_random_bytes(8),'base64'), '/+=OIl0','ABCDEFG'), 1, 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.account_invitations
       WHERE join_code = v_code AND accepted_at IS NULL AND revoked_at IS NULL
    );
    IF v_try > 10 THEN RAISE EXCEPTION 'could not allocate join code'; END IF;
  END LOOP;

  INSERT INTO public.account_invitations (account_kind, account_id, role, join_code, created_by)
  VALUES (_kind, _account_id, _role, v_code, auth.uid())
  RETURNING id INTO v_id;

  invitation_id := v_id;
  join_code := v_code;
  RETURN NEXT;
END;
$$;

-- Accept invitation (via token OR join_code)
CREATE OR REPLACE FUNCTION public.account_accept_invitation(
  _token text DEFAULT NULL,
  _join_code text DEFAULT NULL
)
RETURNS TABLE (account_kind text, account_id uuid, role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv public.account_invitations%ROWTYPE;
  v_user_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _token IS NULL AND _join_code IS NULL THEN RAISE EXCEPTION 'token or code required'; END IF;

  IF _token IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.account_invitations
     WHERE token_hash = _account_hash_token(_token)
     LIMIT 1;
  ELSE
    SELECT * INTO v_inv FROM public.account_invitations
     WHERE join_code = upper(_join_code)
       AND accepted_at IS NULL AND revoked_at IS NULL
     LIMIT 1;
  END IF;

  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invitation not found'; END IF;
  IF v_inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invitation revoked'; END IF;
  IF v_inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invitation already used'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'invitation expired'; END IF;

  -- If email-bound, enforce email match
  IF v_inv.email IS NOT NULL THEN
    SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = auth.uid();
    IF v_user_email IS DISTINCT FROM lower(v_inv.email) THEN
      RAISE EXCEPTION 'invitation reserved for another email';
    END IF;
  END IF;

  INSERT INTO public.account_memberships (user_id, account_kind, account_id, role, status, invited_email, invited_by, accepted_at)
  VALUES (auth.uid(), v_inv.account_kind, v_inv.account_id, v_inv.role, 'active', v_inv.email, v_inv.created_by, now())
  ON CONFLICT (user_id, account_kind, account_id) DO UPDATE
    SET status = 'active', role = EXCLUDED.role, accepted_at = COALESCE(account_memberships.accepted_at, now());

  UPDATE public.account_invitations
     SET accepted_at = now(), accepted_by = auth.uid()
   WHERE id = v_inv.id;

  account_kind := v_inv.account_kind;
  account_id := v_inv.account_id;
  role := v_inv.role;
  RETURN NEXT;
END;
$$;

-- Revoke pending invitation
CREATE OR REPLACE FUNCTION public.account_revoke_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_inv public.account_invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.account_invitations WHERE id = _invitation_id;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT (is_account_admin(v_inv.account_kind, v_inv.account_id) OR is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.account_invitations SET revoked_at = now() WHERE id = _invitation_id AND accepted_at IS NULL;
END;
$$;

-- Revoke member
CREATE OR REPLACE FUNCTION public.account_revoke_member(_membership_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_m public.account_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_m FROM public.account_memberships WHERE id = _membership_id;
  IF v_m.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT (is_account_admin(v_m.account_kind, v_m.account_id) OR is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_m.role = 'admin' AND NOT account_has_other_admin(v_m.account_kind, v_m.account_id, v_m.user_id) THEN
    RAISE EXCEPTION 'cannot revoke last admin';
  END IF;
  UPDATE public.account_memberships SET status = 'revoked' WHERE id = _membership_id;
END;
$$;

-- Update member role
CREATE OR REPLACE FUNCTION public.account_update_member_role(_membership_id uuid, _new_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_m public.account_memberships%ROWTYPE;
BEGIN
  IF _new_role NOT IN ('admin','member') THEN RAISE EXCEPTION 'invalid role'; END IF;
  SELECT * INTO v_m FROM public.account_memberships WHERE id = _membership_id;
  IF v_m.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT (is_account_admin(v_m.account_kind, v_m.account_id) OR is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_m.role = 'admin' AND _new_role = 'member'
     AND NOT account_has_other_admin(v_m.account_kind, v_m.account_id, v_m.user_id) THEN
    RAISE EXCEPTION 'cannot demote last admin';
  END IF;
  UPDATE public.account_memberships SET role = _new_role WHERE id = _membership_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.account_invite_by_email(text,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.account_create_join_code(text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.account_accept_invitation(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.account_revoke_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.account_revoke_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.account_update_member_role(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_buyer_account_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_vendor_account_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_admin(text,uuid) TO authenticated;
