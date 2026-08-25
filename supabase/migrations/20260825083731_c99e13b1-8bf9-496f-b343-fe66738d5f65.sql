CREATE OR REPLACE FUNCTION public._guard_vendors_privileged_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public._is_admin_or_service() THEN
    RETURN NEW;
  END IF;
  IF NEW.validation_status IS DISTINCT FROM OLD.validation_status
     OR NEW.validation_notes IS DISTINCT FROM OLD.validation_notes
     OR NEW.validated_at IS DISTINCT FROM OLD.validated_at
     OR NEW.validated_by IS DISTINCT FROM OLD.validated_by
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.commission_model IS DISTINCT FROM OLD.commission_model
     OR NEW.margin_split_pct IS DISTINCT FROM OLD.margin_split_pct
     OR NEW.fixed_commission_amount IS DISTINCT FROM OLD.fixed_commission_amount
     OR NEW.can_manage_offers IS DISTINCT FROM OLD.can_manage_offers
     OR NEW.auto_forward_to_qogita IS DISTINCT FROM OLD.auto_forward_to_qogita
     OR NEW.qogita_seller_alias IS DISTINCT FROM OLD.qogita_seller_alias
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_onboarding_complete IS DISTINCT FROM OLD.stripe_onboarding_complete
     OR NEW.stripe_charges_enabled IS DISTINCT FROM OLD.stripe_charges_enabled
     OR NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled
     OR NEW.is_top_seller IS DISTINCT FROM OLD.is_top_seller
     OR NEW.is_manufacturer IS DISTINCT FROM OLD.is_manufacturer
     OR NEW.is_authorized_distributor IS DISTINCT FROM OLD.is_authorized_distributor
     OR NEW.distributor_updated_at IS DISTINCT FROM OLD.distributor_updated_at
     OR NEW.distributor_updated_by IS DISTINCT FROM OLD.distributor_updated_by
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.total_sales IS DISTINCT FROM OLD.total_sales
     OR NEW.is_test IS DISTINCT FROM OLD.is_test
  THEN
    RAISE EXCEPTION 'Not allowed to modify validation, activation, commission or platform-managed vendor fields' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_vendors_privileged_cols ON public.vendors;
CREATE TRIGGER trg_guard_vendors_privileged_cols
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public._guard_vendors_privileged_cols();