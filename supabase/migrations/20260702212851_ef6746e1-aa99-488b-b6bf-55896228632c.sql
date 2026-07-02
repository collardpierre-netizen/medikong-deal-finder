
-- Lock sensitive columns against self-privilege-escalation via BEFORE UPDATE triggers.
-- Admins (is_admin) and service_role are allowed to modify these columns; end users are not.

CREATE OR REPLACE FUNCTION public._is_admin_or_service()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  BEGIN
    jwt_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN OTHERS THEN
    jwt_role := NULL;
  END;
  IF jwt_role = 'service_role' THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN true; -- backend/DB-level operations without JWT (e.g. triggers, cron jobs)
  END IF;
  RETURN public.is_admin(auth.uid());
END;
$$;

-- customers: lock is_verified, credit_limit, payment_terms_days, vat_number
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
  THEN
    RAISE EXCEPTION 'Not allowed to modify verification, credit, payment terms or VAT number' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_customers_privileged_cols ON public.customers;
CREATE TRIGGER trg_guard_customers_privileged_cols
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public._guard_customers_privileged_cols();

-- profiles: lock price_level_code, buyer_profile_id
CREATE OR REPLACE FUNCTION public._guard_profiles_privileged_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._is_admin_or_service() THEN
    RETURN NEW;
  END IF;
  IF NEW.price_level_code IS DISTINCT FROM OLD.price_level_code
     OR NEW.buyer_profile_id IS DISTINCT FROM OLD.buyer_profile_id
  THEN
    RAISE EXCEPTION 'Not allowed to modify price_level_code or buyer_profile_id' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_privileged_cols ON public.profiles;
CREATE TRIGGER trg_guard_profiles_privileged_cols
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public._guard_profiles_privileged_cols();

-- vendor_kyc_submissions: lock status, reviewed_by, reviewed_at
CREATE OR REPLACE FUNCTION public._guard_vendor_kyc_privileged_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._is_admin_or_service() THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
  THEN
    RAISE EXCEPTION 'Not allowed to modify KYC review fields' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_vendor_kyc_privileged_cols ON public.vendor_kyc_submissions;
CREATE TRIGGER trg_guard_vendor_kyc_privileged_cols
BEFORE UPDATE ON public.vendor_kyc_submissions
FOR EACH ROW EXECUTE FUNCTION public._guard_vendor_kyc_privileged_cols();

-- vendors: lock validation_status, is_verified, is_active, commission_rate, margin_split_pct,
-- fixed_commission_amount and stripe_* fields against vendor self-updates
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
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.margin_split_pct IS DISTINCT FROM OLD.margin_split_pct
     OR NEW.fixed_commission_amount IS DISTINCT FROM OLD.fixed_commission_amount
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_charges_enabled IS DISTINCT FROM OLD.stripe_charges_enabled
     OR NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled
     OR NEW.stripe_details_submitted IS DISTINCT FROM OLD.stripe_details_submitted
  THEN
    RAISE EXCEPTION 'Not allowed to modify validation, verification, activation, commission or Stripe fields' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_vendors_privileged_cols ON public.vendors;
CREATE TRIGGER trg_guard_vendors_privileged_cols
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public._guard_vendors_privileged_cols();
