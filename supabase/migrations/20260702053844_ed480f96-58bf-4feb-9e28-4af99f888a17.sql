CREATE OR REPLACE FUNCTION public.guard_vendors_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.validation_status IS DISTINCT FROM OLD.validation_status
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.margin_split_pct IS DISTINCT FROM OLD.margin_split_pct
     OR NEW.fixed_commission_amount IS DISTINCT FROM OLD.fixed_commission_amount
     OR NEW.iban IS DISTINCT FROM OLD.iban
     OR NEW.bic IS DISTINCT FROM OLD.bic
     OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
  THEN
    RAISE EXCEPTION 'Only admins can modify vendor validation, commission, or banking fields';
  END IF;
  RETURN NEW;
END;
$$;