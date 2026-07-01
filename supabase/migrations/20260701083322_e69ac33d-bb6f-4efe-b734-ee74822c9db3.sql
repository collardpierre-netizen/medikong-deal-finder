
-- Guard triggers to prevent privilege escalation via self-updates.
-- Admins (is_admin(auth.uid())) and service_role bypass these guards.

-- 1. buyers.is_active
CREATE OR REPLACE FUNCTION public.guard_buyers_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Only admins can modify is_active on buyers';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_buyers_privileged ON public.buyers;
CREATE TRIGGER trg_guard_buyers_privileged
BEFORE UPDATE ON public.buyers
FOR EACH ROW EXECUTE FUNCTION public.guard_buyers_privileged_columns();

-- 2. customers.is_verified / credit_limit / payment_terms_days
CREATE OR REPLACE FUNCTION public.guard_customers_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.credit_limit IS DISTINCT FROM OLD.credit_limit
     OR NEW.payment_terms_days IS DISTINCT FROM OLD.payment_terms_days THEN
    RAISE EXCEPTION 'Only admins can modify verification or credit terms on customers';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_customers_privileged ON public.customers;
CREATE TRIGGER trg_guard_customers_privileged
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.guard_customers_privileged_columns();

-- 3. vendor_kyc_submissions.status / reviewed_by / reviewed_at / admin_notes
CREATE OR REPLACE FUNCTION public.guard_vendor_kyc_submissions_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
    RAISE EXCEPTION 'Only admins can modify KYC review fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_vendor_kyc_submissions_privileged ON public.vendor_kyc_submissions;
CREATE TRIGGER trg_guard_vendor_kyc_submissions_privileged
BEFORE UPDATE ON public.vendor_kyc_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_kyc_submissions_privileged_columns();

-- 4. vendors: is_verified / validation_status / is_active / commission_rate / margin_split_pct / accepts_rfq
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
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.validation_status IS DISTINCT FROM OLD.validation_status
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.margin_split_pct IS DISTINCT FROM OLD.margin_split_pct
     OR NEW.accepts_rfq IS DISTINCT FROM OLD.accepts_rfq THEN
    RAISE EXCEPTION 'Only admins can modify vendor validation, activation or commission fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_vendors_privileged ON public.vendors;
CREATE TRIGGER trg_guard_vendors_privileged
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.guard_vendors_privileged_columns();
