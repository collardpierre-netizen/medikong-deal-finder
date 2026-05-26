
-- ============================================================================
-- Lot 1 : rfq_admin_add_vendor — ajout du paramètre _bypass_eligibility
-- ============================================================================
DROP FUNCTION IF EXISTS public.rfq_admin_add_vendor(uuid, uuid);

CREATE OR REPLACE FUNCTION public.rfq_admin_add_vendor(
  _rfq_id uuid,
  _vendor_id uuid,
  _bypass_eligibility boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _reason public.rfq_target_reason;
  _notif_id uuid;
  _was_new boolean;
  _rfq record;
  _bypassed boolean := false;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id, product_id, brand_id, quantity, destination_country_code, responses_deadline
  INTO _rfq FROM public.rfqs WHERE id = _rfq_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RFQ % not found', _rfq_id;
  END IF;

  -- Tente d'abord la résolution éligibilité standard
  SELECT reason INTO _reason
  FROM public.rfq_score_target_vendors(_rfq_id)
  WHERE vendor_id = _vendor_id
  LIMIT 1;

  IF _reason IS NULL THEN
    IF NOT _bypass_eligibility THEN
      RAISE EXCEPTION 'Vendor % does not pass eligibility filters for RFQ %', _vendor_id, _rfq_id
        USING ERRCODE = '22023';
    END IF;
    -- Bypass : on force l'ajout avec reason='manual'
    _reason := 'manual'::public.rfq_target_reason;
    _bypassed := true;
  END IF;

  INSERT INTO public.rfq_dispatch_log (rfq_id, vendor_id, reason, status)
  VALUES (_rfq_id, _vendor_id, _reason, 'dispatched')
  ON CONFLICT (rfq_id, vendor_id) DO NOTHING
  RETURNING true INTO _was_new;

  _was_new := COALESCE(_was_new, false);

  IF _was_new THEN
    INSERT INTO public.vendor_notifications (vendor_id, type, title, body, cta_url, payload)
    VALUES (_vendor_id, 'rfq_received', 'Nouvelle demande de prix',
            'Un acheteur sollicite un devis. Connectez-vous à votre portail vendeur pour répondre avant expiration.',
            '/vendor/rfq/' || _rfq_id::text,
            jsonb_build_object(
              'rfq_id', _rfq_id, 'reason', _reason::text,
              'product_id', _rfq.product_id, 'brand_id', _rfq.brand_id,
              'quantity', _rfq.quantity, 'country', _rfq.destination_country_code,
              'deadline', _rfq.responses_deadline,
              'added_by_admin', true,
              'bypassed_eligibility', _bypassed))
    RETURNING id INTO _notif_id;

    UPDATE public.rfq_dispatch_log
      SET notification_id = _notif_id
      WHERE rfq_id = _rfq_id AND vendor_id = _vendor_id;

    INSERT INTO public.rfq_routing_audit_log
      (rfq_id, vendor_id, decision, reason_code, reason_label, matched_reason, details)
    VALUES (_rfq_id, _vendor_id, 'selected',
            CASE WHEN _bypassed THEN 'manual_admin_bypass' ELSE 'manual_admin' END,
            CASE WHEN _bypassed
                 THEN 'Forcé par un administrateur (bypass éligibilité)'
                 ELSE 'Ajouté manuellement par un administrateur' END,
            _reason,
            jsonb_build_object('admin_user_id', auth.uid(), 'bypassed', _bypassed))
    ON CONFLICT (rfq_id, vendor_id) DO UPDATE SET
      decision = 'selected',
      reason_code = EXCLUDED.reason_code,
      reason_label = EXCLUDED.reason_label;

    UPDATE public.rfqs SET total_targeted = (
      SELECT COUNT(*) FROM public.rfq_dispatch_log WHERE rfq_id = _rfq_id
    ) WHERE id = _rfq_id;
  END IF;

  RETURN jsonb_build_object(
    'rfq_id', _rfq_id,
    'vendor_id', _vendor_id,
    'was_new', _was_new,
    'reason', _reason,
    'bypassed', _bypassed,
    'notification_id', _notif_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rfq_admin_add_vendor(uuid, uuid, boolean)
  TO authenticated, service_role;

-- ============================================================================
-- Lot 2 : rfq_external_invitations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rfq_external_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  external_vendor_id uuid NOT NULL REFERENCES public.external_vendors(id) ON DELETE CASCADE,
  contact_email text NOT NULL,
  contact_name text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','viewed','responded','declined','expired')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at timestamptz,
  responded_at timestamptz,
  token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  email_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, external_vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_ext_inv_rfq ON public.rfq_external_invitations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_ext_inv_vendor ON public.rfq_external_invitations(external_vendor_id);
CREATE INDEX IF NOT EXISTS idx_rfq_ext_inv_token ON public.rfq_external_invitations(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfq_external_invitations TO authenticated;
GRANT ALL ON public.rfq_external_invitations TO service_role;

ALTER TABLE public.rfq_external_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage external rfq invitations"
ON public.rfq_external_invitations
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_rfq_ext_inv_updated_at
  BEFORE UPDATE ON public.rfq_external_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Lot 3 : rfq_external_responses
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rfq_external_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL UNIQUE REFERENCES public.rfq_external_invitations(id) ON DELETE CASCADE,
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  external_vendor_id uuid NOT NULL REFERENCES public.external_vendors(id) ON DELETE CASCADE,
  unit_price_excl_vat_cents integer NOT NULL CHECK (unit_price_excl_vat_cents >= 0),
  currency_code text NOT NULL DEFAULT 'EUR',
  quantity_available integer,
  lead_time_days integer,
  validity_days integer,
  payment_terms text,
  comment text,
  attachments_urls text[] NOT NULL DEFAULT '{}',
  contact_email text,
  contact_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfq_ext_resp_rfq ON public.rfq_external_responses(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_ext_resp_vendor ON public.rfq_external_responses(external_vendor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfq_external_responses TO authenticated;
GRANT ALL ON public.rfq_external_responses TO service_role;

ALTER TABLE public.rfq_external_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage external rfq responses"
ON public.rfq_external_responses
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_rfq_ext_resp_updated_at
  BEFORE UPDATE ON public.rfq_external_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Lot 4 : RPC admin — créer une invitation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rfq_admin_invite_external_vendor(
  _rfq_id uuid,
  _external_vendor_id uuid,
  _contact_email text,
  _contact_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Reuse existing invitation if any
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
    _token := encode(gen_random_bytes(24), 'hex');
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

-- ============================================================================
-- Lot 5 : RPC publique — récupérer l'invitation via token (marque vu)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rfq_external_get_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inv record;
  _rfq record;
  _vendor record;
  _product_name text;
  _brand_name text;
  _response jsonb;
BEGIN
  SELECT * INTO _inv
  FROM public.rfq_external_invitations
  WHERE token = _token;

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

  -- Existing response (if any)
  SELECT to_jsonb(r) INTO _response
  FROM public.rfq_external_responses r
  WHERE r.invitation_id = _inv.id;

  -- Mark as viewed (first time only)
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
$$;

GRANT EXECUTE ON FUNCTION public.rfq_external_get_invitation(text)
  TO anon, authenticated, service_role;

-- ============================================================================
-- Lot 6 : RPC publique — soumettre la réponse
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rfq_external_submit_response(
  _token text,
  _unit_price_excl_vat_cents integer,
  _currency_code text DEFAULT 'EUR',
  _quantity_available integer DEFAULT NULL,
  _lead_time_days integer DEFAULT NULL,
  _validity_days integer DEFAULT NULL,
  _payment_terms text DEFAULT NULL,
  _comment text DEFAULT NULL,
  _attachments_urls text[] DEFAULT '{}',
  _contact_email text DEFAULT NULL,
  _contact_name text DEFAULT NULL,
  _decline boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inv record;
  _resp_id uuid;
BEGIN
  SELECT * INTO _inv
  FROM public.rfq_external_invitations
  WHERE token = _token;

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
$$;

GRANT EXECUTE ON FUNCTION public.rfq_external_submit_response(text, integer, text, integer, integer, integer, text, text, text[], text, text, boolean)
  TO anon, authenticated, service_role;
