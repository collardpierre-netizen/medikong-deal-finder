-- 1) restock_buyers.access_token : unused cleartext bearer token, drop it.
ALTER TABLE public.restock_buyers DROP COLUMN IF EXISTS access_token;

-- 2) rfq_external_invitations : replace cleartext `token` by SHA-256 `token_hash`.
ALTER TABLE public.rfq_external_invitations
  ADD COLUMN IF NOT EXISTS token_hash text;

UPDATE public.rfq_external_invitations
   SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
 WHERE token_hash IS NULL AND token IS NOT NULL;

DROP INDEX IF EXISTS public.idx_rfq_ext_inv_token;

ALTER TABLE public.rfq_external_invitations
  DROP COLUMN IF EXISTS token;

ALTER TABLE public.rfq_external_invitations
  ALTER COLUMN token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rfq_ext_inv_token_hash
  ON public.rfq_external_invitations(token_hash);

-- 3) Public RPC : lookup by hash, never by cleartext.
CREATE OR REPLACE FUNCTION public.rfq_external_get_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  _hash text;
  _inv record;
  _rfq record;
  _vendor record;
  _product_name text;
  _brand_name text;
  _response jsonb;
BEGIN
  IF _token IS NULL OR length(_token) = 0 THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  SELECT * INTO _inv
  FROM public.rfq_external_invitations
  WHERE token_hash = _hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF _inv.token_expires_at < now() THEN
    UPDATE public.rfq_external_invitations SET status = 'expired' WHERE id = _inv.id;
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT id, product_id, brand_id, quantity, target_price_excl_vat_cents,
         destination_country_code, responses_deadline, desired_delivery_date,
         payment_terms, required_offer_validity_days, comment, currency_code, status
    INTO _rfq FROM public.rfqs WHERE id = _inv.rfq_id;

  SELECT id, name, logo_url, country_code, website_url
    INTO _vendor FROM public.external_vendors WHERE id = _inv.external_vendor_id;

  IF _rfq.product_id IS NOT NULL THEN
    SELECT name INTO _product_name FROM public.products WHERE id = _rfq.product_id;
  END IF;
  IF _rfq.brand_id IS NOT NULL THEN
    SELECT name INTO _brand_name FROM public.brands WHERE id = _rfq.brand_id;
  END IF;

  SELECT to_jsonb(r) INTO _response
  FROM public.rfq_external_responses r
  WHERE r.invitation_id = _inv.id;

  IF _inv.status = 'invited' THEN
    UPDATE public.rfq_external_invitations
      SET status = 'viewed', viewed_at = now()
      WHERE id = _inv.id;
  END IF;

  RETURN jsonb_build_object(
    'invitation', jsonb_build_object(
      'id', _inv.id,
      'status', CASE WHEN _inv.status = 'invited' THEN 'viewed' ELSE _inv.status END,
      'contact_email', _inv.contact_email,
      'contact_name', _inv.contact_name,
      'token_expires_at', _inv.token_expires_at,
      'responded_at', _inv.responded_at
    ),
    'rfq', jsonb_build_object(
      'id', _rfq.id,
      'status', _rfq.status,
      'product_name', _product_name,
      'brand_name', _brand_name,
      'quantity', _rfq.quantity,
      'target_price_excl_vat_cents', _rfq.target_price_excl_vat_cents,
      'currency_code', _rfq.currency_code,
      'destination_country_code', _rfq.destination_country_code,
      'responses_deadline', _rfq.responses_deadline,
      'desired_delivery_date', _rfq.desired_delivery_date,
      'payment_terms', _rfq.payment_terms,
      'required_offer_validity_days', _rfq.required_offer_validity_days,
      'comment', _rfq.comment
    ),
    'vendor', jsonb_build_object(
      'id', _vendor.id,
      'name', _vendor.name,
      'logo_url', _vendor.logo_url,
      'country_code', _vendor.country_code
    ),
    'response', _response
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.rfq_external_submit_response(
  _token text,
  _unit_price_excl_vat_cents integer,
  _currency_code text DEFAULT 'EUR',
  _quantity_available integer DEFAULT NULL,
  _lead_time_days integer DEFAULT NULL,
  _validity_days integer DEFAULT NULL,
  _payment_terms text DEFAULT NULL,
  _comment text DEFAULT NULL,
  _attachments_urls text[] DEFAULT NULL,
  _contact_email text DEFAULT NULL,
  _contact_name text DEFAULT NULL,
  _decline boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  _hash text;
  _inv record;
  _resp_id uuid;
BEGIN
  IF _token IS NULL OR length(_token) = 0 THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '22023';
  END IF;

  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  SELECT * INTO _inv
  FROM public.rfq_external_invitations
  WHERE token_hash = _hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '22023';
  END IF;

  IF _inv.token_expires_at < now() THEN
    UPDATE public.rfq_external_invitations SET status = 'expired' WHERE id = _inv.id;
    RAISE EXCEPTION 'Invitation expired' USING ERRCODE = '22023';
  END IF;

  IF _decline THEN
    UPDATE public.rfq_external_invitations
      SET status = 'declined', responded_at = now()
      WHERE id = _inv.id;
    RETURN jsonb_build_object('declined', true, 'invitation_id', _inv.id);
  END IF;

  IF _unit_price_excl_vat_cents IS NULL OR _unit_price_excl_vat_cents < 0 THEN
    RAISE EXCEPTION 'unit_price_excl_vat_cents is required and must be >= 0';
  END IF;

  INSERT INTO public.rfq_external_responses
    (invitation_id, rfq_id, external_vendor_id, unit_price_excl_vat_cents, currency_code,
     quantity_available, lead_time_days, validity_days, payment_terms, comment,
     attachments_urls, contact_email, contact_name)
  VALUES (_inv.id, _inv.rfq_id, _inv.external_vendor_id, _unit_price_excl_vat_cents,
          COALESCE(_currency_code, 'EUR'), _quantity_available, _lead_time_days, _validity_days,
          _payment_terms, _comment, COALESCE(_attachments_urls, '{}'),
          COALESCE(_contact_email, _inv.contact_email), COALESCE(_contact_name, _inv.contact_name))
  ON CONFLICT (invitation_id) DO UPDATE SET
    unit_price_excl_vat_cents = EXCLUDED.unit_price_excl_vat_cents,
    currency_code = EXCLUDED.currency_code,
    quantity_available = EXCLUDED.quantity_available,
    lead_time_days = EXCLUDED.lead_time_days,
    validity_days = EXCLUDED.validity_days,
    payment_terms = EXCLUDED.payment_terms,
    comment = EXCLUDED.comment,
    attachments_urls = EXCLUDED.attachments_urls,
    contact_email = EXCLUDED.contact_email,
    contact_name = EXCLUDED.contact_name,
    updated_at = now()
  RETURNING id INTO _resp_id;

  UPDATE public.rfq_external_invitations
    SET status = 'responded', responded_at = now()
    WHERE id = _inv.id;

  RETURN jsonb_build_object('response_id', _resp_id, 'invitation_id', _inv.id);
END;
$fn$;

-- 4) Admin RPC : generate raw token, store hash, return raw token once.
CREATE OR REPLACE FUNCTION public.rfq_admin_invite_external_vendor(
  _rfq_id uuid,
  _external_vendor_id uuid,
  _contact_email text,
  _contact_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  _token text;
  _hash text;
  _inv_id uuid;
  _existing_id uuid;
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

  _token := encode(extensions.gen_random_bytes(24), 'hex');
  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  SELECT id INTO _existing_id
  FROM public.rfq_external_invitations
  WHERE rfq_id = _rfq_id AND external_vendor_id = _external_vendor_id
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.rfq_external_invitations
      SET contact_email = _contact_email,
          contact_name = COALESCE(_contact_name, contact_name),
          token_hash = _hash,
          token_expires_at = GREATEST(token_expires_at, now() + interval '30 days')
      WHERE id = _existing_id;
    _inv_id := _existing_id;
  ELSE
    INSERT INTO public.rfq_external_invitations
      (rfq_id, external_vendor_id, contact_email, contact_name, token_hash, invited_by)
    VALUES (_rfq_id, _external_vendor_id, _contact_email, _contact_name, _hash, auth.uid())
    RETURNING id INTO _inv_id;
    _was_new := true;
  END IF;

  RETURN jsonb_build_object(
    'invitation_id', _inv_id,
    'token', _token,
    'was_new', _was_new
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.rfq_admin_invite_external_vendor(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rfq_admin_invite_external_vendor(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rfq_external_get_invitation(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rfq_external_submit_response(
  text, integer, text, integer, integer, integer, text, text, text[], text, text, boolean
) TO anon, authenticated, service_role;