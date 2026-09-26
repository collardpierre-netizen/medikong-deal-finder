CREATE OR REPLACE FUNCTION public._qogita_reactivate_vendor_on_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_old_role text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.vendors WHERE id = NEW.vendor_id AND is_active = false AND qogita_auto_deactivated_at IS NOT NULL) THEN
    v_old_role := current_setting('request.jwt.claim.role', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM set_config('app.qogita_system_sweep', 'on', true);
    UPDATE public.vendors SET is_active = true, qogita_auto_deactivated_at = NULL, updated_at = now()
     WHERE id = NEW.vendor_id AND is_active = false AND qogita_auto_deactivated_at IS NOT NULL;
    PERFORM set_config('app.qogita_system_sweep', 'off', true);
    PERFORM set_config('request.jwt.claim.role', COALESCE(v_old_role, ''), true);
  END IF;
  RETURN NEW;
END;
$function$;