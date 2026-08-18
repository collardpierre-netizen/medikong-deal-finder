CREATE OR REPLACE FUNCTION public.account_list_members(_kind text, _account_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role text,
  status text,
  invited_email text,
  accepted_at timestamptz,
  created_at timestamptz,
  display_name text,
  email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_account_admin(_kind, _account_id)
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.account_memberships m
      WHERE m.account_kind = _kind
        AND m.account_id = _account_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.user_id,
    m.role::text,
    m.status::text,
    m.invited_email,
    m.accepted_at,
    m.created_at,
    NULLIF(TRIM(COALESCE(p.full_name, '')), '') AS display_name,
    COALESCE(m.invited_email, u.email::text) AS email
  FROM public.account_memberships m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  WHERE m.account_kind = _kind
    AND m.account_id = _account_id
  ORDER BY m.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.account_list_members(text, uuid) TO authenticated;