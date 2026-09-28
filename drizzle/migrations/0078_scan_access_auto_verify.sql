CREATE OR REPLACE FUNCTION public._tg_customers_scan_auto_verify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Accès Scan ouvert par un admin (ou service) => officine vérifiée en même temps.
  IF NEW.scan_enabled IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.scan_enabled IS DISTINCT FROM TRUE)
     AND public._is_admin_or_service() THEN
    NEW.is_verified := true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_customers_scan_auto_verify ON public.customers;
CREATE TRIGGER trg_customers_scan_auto_verify
BEFORE INSERT OR UPDATE OF scan_enabled ON public.customers
FOR EACH ROW EXECUTE FUNCTION public._tg_customers_scan_auto_verify();