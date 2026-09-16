DROP TRIGGER IF EXISTS trg_guard_customers_privileged_cols ON public.customers;
CREATE TRIGGER trg_guard_customers_privileged_cols
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public._guard_customers_privileged_cols();

DROP TRIGGER IF EXISTS trg_guard_profiles_privileged_cols ON public.profiles;
CREATE TRIGGER trg_guard_profiles_privileged_cols
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public._guard_profiles_privileged_cols();

DROP TRIGGER IF EXISTS trg_guard_vendors_privileged_cols ON public.vendors;
CREATE TRIGGER trg_guard_vendors_privileged_cols
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public._guard_vendors_privileged_cols();