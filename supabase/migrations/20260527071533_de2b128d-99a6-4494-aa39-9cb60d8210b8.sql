CREATE OR REPLACE FUNCTION public.rfq_admin_invite_external_vendor(
  _rfq_id uuid,
  _external_vendor_id uuid,
  _contact_email text,
  _contact_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _token text;
  _inv_id uuid;
  _existing_id uuid;
  _existing_token text;
  _was_new boolean := false;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _contact_email IS NULL OR length(trim(_contact_email)) = 0 THEN
    RAISE EXCEPTION 'contact_email is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.rfqs WHERE id = _rfq_id) THEN
    RAISE EXCEPTION 'RFQ % not found', _rfq_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.external_vendors WHERE id = _external_vendor_id) THEN
    RAISE EXCEPTION 'External vendor % not found', _external_vendor_id;
  END IF;

  SELECT id, token INTO _existing_id, _existing_token
  FROM public.rfq_external_invitations
  WHERE rfq_id = _rfq_id AND external_vendor_id = _external_vendor_id
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.rfq_external_invitations
      SET contact_email = _contact_email,
          contact_name = COALESCE(_contact_name, contact_name),
          token_expires_at = GREATEST(token_expires_at, now() + interval '30 days')
      WHERE id = _existing_id;
    _inv_id := _existing_id;
    _token := _existing_token;
  ELSE
    _token := encode(extensions.gen_random_bytes(24), 'hex');
    INSERT INTO public.rfq_external_invitations
      (rfq_id, external_vendor_id, contact_email, contact_name, token, invited_by)
    VALUES (_rfq_id, _external_vendor_id, _contact_email, _contact_name, _token, auth.uid())
    RETURNING id INTO _inv_id;
    _was_new := true;
  END IF;

  RETURN jsonb_build_object(
    'invitation_id', _inv_id,
    'token', _token,
    'was_new', _was_new
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rfq_admin_invite_external_vendor(uuid, uuid, text, text)
  TO authenticated, service_role;