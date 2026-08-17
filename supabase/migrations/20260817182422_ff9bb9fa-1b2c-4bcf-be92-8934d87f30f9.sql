CREATE OR REPLACE FUNCTION public.guard_customers_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Bypass for admins, service_role and JWT-less backend operations
  -- (restores the service_role bypass lost vs migration 20260701083322).
  IF public._is_admin_or_service() THEN
    RETURN NEW;
  END IF;
  -- NOTE: the previous version also tested NEW.is_active, a column that never
  -- existed on public.customers (copy/paste from the vendors guard). It made
  -- every UPDATE on customers crash. The rule has no object here and is dropped.
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.credit_limit IS DISTINCT FROM OLD.credit_limit
     OR NEW.payment_terms_days IS DISTINCT FROM OLD.payment_terms_days
     OR NEW.customer_type IS DISTINCT FROM OLD.customer_type
  THEN
    RAISE EXCEPTION 'Only admins can modify privileged customer fields (is_verified, credit_limit, payment_terms_days, customer_type)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;