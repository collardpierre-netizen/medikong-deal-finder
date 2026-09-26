CREATE OR REPLACE FUNCTION public.vendors_block_self_privesc()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Internal Qogita sweep only (flag set transaction-locally by qogita_sweep_empty_vendors / reactivation trigger), is_active change only
  IF current_setting('app.qogita_system_sweep', true) = 'on'
     AND NEW.is_verified IS NOT DISTINCT FROM OLD.is_verified
     AND NEW.validation_status IS NOT DISTINCT FROM OLD.validation_status
     AND NEW.commission_rate IS NOT DISTINCT FROM OLD.commission_rate
     AND NEW.commission_model IS NOT DISTINCT FROM OLD.commission_model
     AND NEW.stripe_payouts_enabled IS NOT DISTINCT FROM OLD.stripe_payouts_enabled
     AND NEW.stripe_charges_enabled IS NOT DISTINCT FROM OLD.stripe_charges_enabled
     AND NEW.stripe_account_id IS NOT DISTINCT FROM OLD.stripe_account_id
     AND NEW.can_manage_offers IS NOT DISTINCT FROM OLD.can_manage_offers
     AND NEW.auth_user_id IS NOT DISTINCT FROM OLD.auth_user_id THEN
    RETURN NEW;
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.validation_status IS DISTINCT FROM OLD.validation_status
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.commission_model IS DISTINCT FROM OLD.commission_model
     OR NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled
     OR NEW.stripe_charges_enabled IS DISTINCT FROM OLD.stripe_charges_enabled
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.can_manage_offers IS DISTINCT FROM OLD.can_manage_offers
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
    RAISE EXCEPTION 'Forbidden: only admins can change sensitive vendor fields';
  END IF;
  RETURN NEW;
END $function$;

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
  PERFORM set_config('app.qogita_system_sweep', 'on', true);
  UPDATE public.vendors v SET is_active = false, qogita_auto_deactivated_at = now(), updated_at = now()
   WHERE v.qogita_seller_alias IS NOT NULL AND v.name <> 'MediKong' AND v.is_active
     AND NOT EXISTS (SELECT 1 FROM public.offers o WHERE o.vendor_id = v.id AND o.is_active);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.qogita_system_sweep', 'off', true);
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
    PERFORM set_config('app.qogita_system_sweep', 'on', true);
    UPDATE public.vendors SET is_active = true, qogita_auto_deactivated_at = NULL, updated_at = now()
     WHERE id = NEW.vendor_id AND is_active = false AND qogita_auto_deactivated_at IS NOT NULL;
    PERFORM set_config('app.qogita_system_sweep', 'off', true);
  END IF;
  RETURN NEW;
END;
$function$;