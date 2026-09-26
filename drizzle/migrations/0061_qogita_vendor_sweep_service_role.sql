CREATE OR REPLACE FUNCTION public.qogita_sweep_empty_vendors(_enforce_guardrail boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_total int; v_cand int; v_n int;
BEGIN
  SELECT count(*) INTO v_total FROM public.vendors WHERE qogita_seller_alias IS NOT NULL AND name <> 'MediKong' AND is_active;
  SELECT count(*) INTO v_cand FROM public.vendors v
   WHERE v.qogita_seller_alias IS NOT NULL AND v.name <> 'MediKong' AND v.is_active
     AND NOT EXISTS (SELECT 1 FROM public.offers o WHERE o.vendor_id = v.id AND o.is_active);
  IF _enforce_guardrail AND v_total > 0 AND v_cand::numeric / v_total > 0.20 THEN
    RETURN jsonb_build_object('status','needs_review','candidates',v_cand,'total',v_total);
  END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.vendors v SET is_active = false, qogita_auto_deactivated_at = now(), updated_at = now()
   WHERE v.qogita_seller_alias IS NOT NULL AND v.name <> 'MediKong' AND v.is_active
     AND NOT EXISTS (SELECT 1 FROM public.offers o WHERE o.vendor_id = v.id AND o.is_active);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('status','success','deactivated',v_n,'total',v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public._qogita_reactivate_vendor_on_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vendors WHERE id = NEW.vendor_id AND is_active = false AND qogita_auto_deactivated_at IS NOT NULL) THEN
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    UPDATE public.vendors SET is_active = true, qogita_auto_deactivated_at = NULL, updated_at = now()
     WHERE id = NEW.vendor_id AND is_active = false AND qogita_auto_deactivated_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$function$;