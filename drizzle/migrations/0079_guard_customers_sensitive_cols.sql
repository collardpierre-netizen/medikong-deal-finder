CREATE OR REPLACE FUNCTION public.guard_customers_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public._is_admin_or_service() THEN
    RETURN NEW;
  END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.credit_limit IS DISTINCT FROM OLD.credit_limit
     OR NEW.payment_terms_days IS DISTINCT FROM OLD.payment_terms_days
     OR NEW.customer_type IS DISTINCT FROM OLD.customer_type
     OR NEW.scan_enabled IS DISTINCT FROM OLD.scan_enabled
     OR NEW.is_test IS DISTINCT FROM OLD.is_test
     OR NEW.buyer_profile_id IS DISTINCT FROM OLD.buyer_profile_id
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.peppol_verified_at IS DISTINCT FROM OLD.peppol_verified_at
     OR NEW.peppol_directory_status IS DISTINCT FROM OLD.peppol_directory_status
  THEN
    RAISE EXCEPTION 'Only admins can modify privileged customer fields'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_customers_privileged_columns_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.is_verified := false;
  NEW.credit_limit := 0;
  NEW.payment_terms_days := 0;
  NEW.scan_enabled := false;
  NEW.is_test := false;
  RETURN NEW;
END $$;