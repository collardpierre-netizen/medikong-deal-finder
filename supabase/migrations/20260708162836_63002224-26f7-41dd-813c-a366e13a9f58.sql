-- Force safe defaults on INSERT for non-privileged actors on customers.
CREATE OR REPLACE FUNCTION public.guard_customers_privileged_columns_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Silently reset privileged columns to safe defaults regardless of client input.
  NEW.is_verified := false;
  NEW.credit_limit := 0;
  NEW.payment_terms_days := 0;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_customers_privileged_insert ON public.customers;
CREATE TRIGGER trg_guard_customers_privileged_insert
BEFORE INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.guard_customers_privileged_columns_insert();

-- Force safe defaults on INSERT for non-privileged actors on profiles.price_level_code.
CREATE OR REPLACE FUNCTION public.guard_profiles_privileged_columns_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.price_level_code := NULL;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_profiles_privileged_insert ON public.profiles;
CREATE TRIGGER trg_guard_profiles_privileged_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_privileged_columns_insert();