
-- Trace columns for compliance edits
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS distributor_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS distributor_updated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS mandate_updated_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.vendors.distributor_updated_at IS
  'Date à laquelle un admin a modifié le drapeau is_authorized_distributor.';
COMMENT ON COLUMN public.vendors.distributor_updated_by IS
  'Admin ayant modifié en dernier le drapeau is_authorized_distributor.';
COMMENT ON COLUMN public.vendors.mandate_updated_by IS
  'Admin ayant renseigné/révoqué en dernier mandate_signed_at.';

-- Admin RPC to fix a vendor's compliance flags and trace the change
CREATE OR REPLACE FUNCTION public.admin_set_vendor_compliance(
  _vendor_id UUID,
  _is_authorized_distributor BOOLEAN,
  _mandate_signed_at TIMESTAMPTZ,
  _reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_prev RECORD;
  v_new_mandate TIMESTAMPTZ;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT is_authorized_distributor, mandate_signed_at
    INTO v_prev
    FROM public.vendors
   WHERE id = _vendor_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vendor_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Normalise mandat : si drapeau retiré côté appelant (NULL explicite conservé),
  -- l'appelant peut aussi passer now() pour valider.
  v_new_mandate := _mandate_signed_at;

  UPDATE public.vendors
     SET is_authorized_distributor = COALESCE(_is_authorized_distributor, false),
         distributor_updated_at = CASE
           WHEN COALESCE(_is_authorized_distributor, false) IS DISTINCT FROM COALESCE(v_prev.is_authorized_distributor, false)
             THEN now()
           ELSE distributor_updated_at
         END,
         distributor_updated_by = CASE
           WHEN COALESCE(_is_authorized_distributor, false) IS DISTINCT FROM COALESCE(v_prev.is_authorized_distributor, false)
             THEN v_admin
           ELSE distributor_updated_by
         END,
         mandate_signed_at = v_new_mandate,
         mandate_updated_by = CASE
           WHEN v_new_mandate IS DISTINCT FROM v_prev.mandate_signed_at THEN v_admin
           ELSE mandate_updated_by
         END,
         updated_at = now()
   WHERE id = _vendor_id;

  INSERT INTO public.admin_audit_log(
    admin_user_id, action, entity_type, entity_id, changes, reason
  ) VALUES (
    v_admin,
    'vendor_compliance_update',
    'vendor',
    _vendor_id,
    jsonb_build_object(
      'is_authorized_distributor', jsonb_build_object('from', v_prev.is_authorized_distributor, 'to', COALESCE(_is_authorized_distributor, false)),
      'mandate_signed_at', jsonb_build_object('from', v_prev.mandate_signed_at, 'to', v_new_mandate)
    ),
    _reason
  );

  RETURN jsonb_build_object(
    'ok', true,
    'vendor_id', _vendor_id,
    'is_authorized_distributor', COALESCE(_is_authorized_distributor, false),
    'mandate_signed_at', v_new_mandate,
    'updated_by', v_admin
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_vendor_compliance(UUID, BOOLEAN, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_vendor_compliance(UUID, BOOLEAN, TIMESTAMPTZ, TEXT) TO authenticated;
