
-- Admin utility: list vendors whose owner_user_id is missing or no longer
-- has a valid auth account, with a suggested user (earliest active admin
-- member of that vendor, fallback earliest active member).
CREATE OR REPLACE FUNCTION public.admin_list_vendor_owner_mismatches()
RETURNS TABLE (
  vendor_id uuid,
  vendor_name text,
  company_name text,
  current_owner_user_id uuid,
  current_owner_email text,
  current_owner_has_auth boolean,
  suggested_user_id uuid,
  suggested_user_email text,
  suggested_user_full_name text,
  suggested_role text,
  suggested_accepted_at timestamptz,
  pending_invitations_count integer,
  reason text
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
  WITH owner_check AS (
    SELECT
      v.id AS vendor_id,
      v.name AS vendor_name,
      v.company_name,
      v.owner_user_id AS current_owner_user_id,
      au_owner.email::text AS current_owner_email,
      (au_owner.id IS NOT NULL) AS current_owner_has_auth
    FROM public.vendors v
    LEFT JOIN auth.users au_owner ON au_owner.id = v.owner_user_id
  ),
  suggested AS (
    SELECT DISTINCT ON (m.account_id)
      m.account_id AS vendor_id,
      m.user_id AS suggested_user_id,
      m.role AS suggested_role,
      m.accepted_at AS suggested_accepted_at
    FROM public.account_memberships m
    WHERE m.account_kind = 'vendor'
      AND m.status = 'active'
      AND m.user_id IS NOT NULL
    ORDER BY m.account_id,
             (m.role = 'admin') DESC,
             COALESCE(m.accepted_at, m.created_at) ASC
  ),
  pending_inv AS (
    SELECT account_id AS vendor_id, count(*)::int AS pending_count
    FROM public.account_invitations
    WHERE account_kind = 'vendor'
      AND accepted_at IS NULL
      AND revoked_at IS NULL
    GROUP BY account_id
  )
  SELECT
    oc.vendor_id,
    oc.vendor_name,
    oc.company_name,
    oc.current_owner_user_id,
    oc.current_owner_email,
    oc.current_owner_has_auth,
    s.suggested_user_id,
    au.email::text AS suggested_user_email,
    p.full_name AS suggested_user_full_name,
    s.suggested_role,
    s.suggested_accepted_at,
    COALESCE(pi.pending_count, 0) AS pending_invitations_count,
    CASE
      WHEN oc.current_owner_user_id IS NULL THEN 'owner_missing'
      WHEN NOT oc.current_owner_has_auth THEN 'owner_no_auth'
      WHEN s.suggested_user_id IS NOT NULL
           AND s.suggested_user_id <> oc.current_owner_user_id
           AND NOT EXISTS (
             SELECT 1 FROM public.account_memberships m2
             WHERE m2.account_kind = 'vendor'
               AND m2.account_id = oc.vendor_id
               AND m2.user_id = oc.current_owner_user_id
               AND m2.status = 'active'
           )
        THEN 'owner_not_member'
      ELSE NULL
    END AS reason
  FROM owner_check oc
  LEFT JOIN suggested s ON s.vendor_id = oc.vendor_id
  LEFT JOIN auth.users au ON au.id = s.suggested_user_id
  LEFT JOIN public.profiles p ON p.id = s.suggested_user_id
  LEFT JOIN pending_inv pi ON pi.vendor_id = oc.vendor_id
  WHERE (
    oc.current_owner_user_id IS NULL
    OR NOT oc.current_owner_has_auth
    OR (
      s.suggested_user_id IS NOT NULL
      AND s.suggested_user_id <> oc.current_owner_user_id
      AND NOT EXISTS (
        SELECT 1 FROM public.account_memberships m3
        WHERE m3.account_kind = 'vendor'
          AND m3.account_id = oc.vendor_id
          AND m3.user_id = oc.current_owner_user_id
          AND m3.status = 'active'
      )
    )
  )
  ORDER BY oc.vendor_name NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_vendor_owner_mismatches() TO authenticated;

-- Apply alignment: set vendors.owner_user_id to the chosen user.
-- The chosen user MUST already be an active admin member of the vendor.
CREATE OR REPLACE FUNCTION public.admin_align_vendor_owner(
  _vendor_id uuid,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old uuid;
  v_is_member boolean;
  v_email text;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _vendor_id IS NULL OR _user_id IS NULL THEN
    RAISE EXCEPTION 'vendor_id and user_id are required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.account_memberships
    WHERE account_kind = 'vendor'
      AND account_id = _vendor_id
      AND user_id = _user_id
      AND status = 'active'
      AND role = 'admin'
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'user is not an active admin member of this vendor';
  END IF;

  SELECT owner_user_id INTO v_old FROM public.vendors WHERE id = _vendor_id;

  UPDATE public.vendors
  SET owner_user_id = _user_id,
      updated_at = now()
  WHERE id = _vendor_id;

  SELECT email::text INTO v_email FROM auth.users WHERE id = _user_id;

  INSERT INTO public.audit_logs (
    action, entity_type, entity_id, actor_user_id, metadata
  ) VALUES (
    'vendor_owner_aligned',
    'vendor',
    _vendor_id,
    auth.uid(),
    jsonb_build_object(
      'old_owner_user_id', v_old,
      'new_owner_user_id', _user_id,
      'new_owner_email', v_email
    )
  );

  RETURN jsonb_build_object(
    'vendor_id', _vendor_id,
    'old_owner_user_id', v_old,
    'new_owner_user_id', _user_id,
    'new_owner_email', v_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_align_vendor_owner(uuid, uuid) TO authenticated;
