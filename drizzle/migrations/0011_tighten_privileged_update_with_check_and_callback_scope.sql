-- 1. Helpers (SECURITY DEFINER) to compare submitted values with stored ones inside WITH CHECK
CREATE OR REPLACE FUNCTION public._customers_privileged_intact(
  _id uuid, _is_verified boolean, _credit_limit numeric, _payment_terms_days integer
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.customers;
BEGIN
  IF public._is_admin_or_service() THEN RETURN true; END IF;
  SELECT * INTO r FROM public.customers WHERE id = _id;
  IF NOT FOUND THEN RETURN true; END IF;
  RETURN r.is_verified IS NOT DISTINCT FROM _is_verified
     AND r.credit_limit IS NOT DISTINCT FROM _credit_limit
     AND r.payment_terms_days IS NOT DISTINCT FROM _payment_terms_days;
END;
$$;

CREATE OR REPLACE FUNCTION public._vendors_privileged_intact(
  _id uuid,
  _validation_status public.vendor_validation_status,
  _is_verified boolean,
  _is_active boolean,
  _commission_rate numeric,
  _commission_model public.commission_model_enum,
  _margin_split_pct numeric,
  _fixed_commission_amount numeric
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.vendors;
BEGIN
  IF public._is_admin_or_service() THEN RETURN true; END IF;
  SELECT * INTO r FROM public.vendors WHERE id = _id;
  IF NOT FOUND THEN RETURN true; END IF;
  RETURN r.validation_status IS NOT DISTINCT FROM _validation_status
     AND r.is_verified IS NOT DISTINCT FROM _is_verified
     AND r.is_active IS NOT DISTINCT FROM _is_active
     AND r.commission_rate IS NOT DISTINCT FROM _commission_rate
     AND r.commission_model IS NOT DISTINCT FROM _commission_model
     AND r.margin_split_pct IS NOT DISTINCT FROM _margin_split_pct
     AND r.fixed_commission_amount IS NOT DISTINCT FROM _fixed_commission_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public._offers_commission_intact(
  _id uuid,
  _commission_model text,
  _commission_rate numeric,
  _margin_split_pct numeric,
  _fixed_commission_amount numeric
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.offers;
BEGIN
  IF public._is_admin_or_service() THEN RETURN true; END IF;
  SELECT * INTO r FROM public.offers WHERE id = _id;
  IF NOT FOUND THEN RETURN true; END IF;
  RETURN r.commission_model IS NOT DISTINCT FROM _commission_model
     AND r.commission_rate IS NOT DISTINCT FROM _commission_rate
     AND r.margin_split_pct IS NOT DISTINCT FROM _margin_split_pct
     AND r.fixed_commission_amount IS NOT DISTINCT FROM _fixed_commission_amount;
END;
$$;

REVOKE ALL ON FUNCTION public._customers_privileged_intact(uuid, boolean, numeric, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._vendors_privileged_intact(uuid, public.vendor_validation_status, boolean, boolean, numeric, public.commission_model_enum, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._offers_commission_intact(uuid, text, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._customers_privileged_intact(uuid, boolean, numeric, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._vendors_privileged_intact(uuid, public.vendor_validation_status, boolean, boolean, numeric, public.commission_model_enum, numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._offers_commission_intact(uuid, text, numeric, numeric, numeric) TO authenticated, service_role;

-- 2. customers: pin verification / credit / payment terms in WITH CHECK
DROP POLICY IF EXISTS "Customers update own" ON public.customers;
CREATE POLICY "Customers update own" ON public.customers
FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (
  auth_user_id = auth.uid()
  AND public._customers_privileged_intact(id, is_verified, credit_limit, payment_terms_days)
);

-- 3. vendors: pin validation / activation / commission fields in WITH CHECK
DROP POLICY IF EXISTS "Vendors manage own" ON public.vendors;
CREATE POLICY "Vendors manage own" ON public.vendors
FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (
  auth_user_id = auth.uid()
  AND public._vendors_privileged_intact(
        id, validation_status, is_verified, is_active,
        commission_rate, commission_model, margin_split_pct, fixed_commission_amount)
);

-- 4. offers: pin commission / margin fields in WITH CHECK
DROP POLICY IF EXISTS "Vendors manage own offers" ON public.offers;
CREATE POLICY "Vendors manage own offers" ON public.offers
FOR ALL TO authenticated
USING (vendor_id IN (SELECT vendors.id FROM public.vendors WHERE vendors.auth_user_id = auth.uid()))
WITH CHECK (
  vendor_id IN (SELECT vendors.id FROM public.vendors WHERE vendors.auth_user_id = auth.uid())
  AND public._offers_commission_intact(id, commission_model, commission_rate, margin_split_pct, fixed_commission_amount)
);

-- 5. delegate_callback_requests: buyers only see their own requests within one of their accounts
DROP POLICY IF EXISTS "Buyers can read their callback requests" ON public.delegate_callback_requests;
CREATE POLICY "Buyers can read their callback requests" ON public.delegate_callback_requests
FOR SELECT TO authenticated
USING (
  auth_user_id = auth.uid()
  AND (
    customer_id IS NULL
    OR customer_id = ANY (ARRAY(SELECT public.current_user_buyer_account_ids()))
  )
);