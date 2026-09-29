CREATE OR REPLACE FUNCTION public.admin_set_vendor_compliance(_vendor_id uuid, _is_authorized_distributor boolean, _mandate_signed_at timestamp with time zone, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin UUID := auth.uid();
  v_admin_email TEXT;
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

  SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin;

  INSERT INTO public.admin_audit_log(
    admin_id, admin_email, action, target_type, target_id, metadata
  ) VALUES (
    v_admin,
    v_admin_email,
    'vendor_compliance_update',
    'vendor',
    _vendor_id,
    jsonb_build_object(
      'is_authorized_distributor', jsonb_build_object('from', v_prev.is_authorized_distributor, 'to', COALESCE(_is_authorized_distributor, false)),
      'mandate_signed_at', jsonb_build_object('from', v_prev.mandate_signed_at, 'to', v_new_mandate),
      'reason', _reason
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'vendor_id', _vendor_id,
    'is_authorized_distributor', COALESCE(_is_authorized_distributor, false),
    'mandate_signed_at', v_new_mandate,
    'updated_by', v_admin
  );
END;
$function$;