CREATE OR REPLACE FUNCTION public.account_accept_invitation(_token text DEFAULT NULL::text, _join_code text DEFAULT NULL::text)
 RETURNS TABLE(account_kind text, account_id uuid, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  ON CONFLICT ON CONSTRAINT account_memberships_user_id_account_kind_account_id_key DO UPDATE
    SET status = 'active', role = EXCLUDED.role, accepted_at = COALESCE(account_memberships.accepted_at, now());

  UPDATE public.account_invitations
     SET accepted_at = now(), accepted_by = auth.uid()
   WHERE id = v_inv.id;

  account_kind := v_inv.account_kind;
  account_id := v_inv.account_id;
  role := v_inv.role;
  RETURN NEXT;
END;
$function$;