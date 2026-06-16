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

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO public.account_invitations (account_kind, account_id, email, role, token_hash, created_by)
  VALUES (_kind, _account_id, lower(_email), _role, _account_hash_token(v_token), auth.uid())
  RETURNING id INTO v_id;

  invitation_id := v_id;
  token := v_token;
  RETURN NEXT;
END;
$$;

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
    v_code := upper(substr(translate(encode(extensions.gen_random_bytes(8),'base64'), '/+=OIl0','ABCDEFG'), 1, 6));
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