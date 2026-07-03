-- Extend privileged-columns guards to close remaining self-escalation vectors.

CREATE OR REPLACE FUNCTION public._guard_customers_privileged_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._is_admin_or_service() THEN
    RETURN NEW;
  END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.credit_limit IS DISTINCT FROM OLD.credit_limit
     OR NEW.payment_terms_days IS DISTINCT FROM OLD.payment_terms_days
     OR NEW.vat_number IS DISTINCT FROM OLD.vat_number
     OR NEW.customer_type IS DISTINCT FROM OLD.customer_type
  THEN
    RAISE EXCEPTION 'Not allowed to modify verification, credit, payment terms, VAT number or customer type' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._guard_vendors_privileged_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._is_admin_or_service() THEN
    RETURN NEW;
  END IF;
  IF NEW.validation_status IS DISTINCT FROM OLD.validation_status
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.validated_by IS DISTINCT FROM OLD.validated_by
     OR NEW.validated_at IS DISTINCT FROM OLD.validated_at
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.margin_split_pct IS DISTINCT FROM OLD.margin_split_pct
     OR NEW.fixed_commission_amount IS DISTINCT FROM OLD.fixed_commission_amount
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_charges_enabled IS DISTINCT FROM OLD.stripe_charges_enabled
     OR NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled
     OR NEW.stripe_details_submitted IS DISTINCT FROM OLD.stripe_details_submitted
  THEN
    RAISE EXCEPTION 'Not allowed to modify validation, activation, validators or commission/Stripe fields' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;