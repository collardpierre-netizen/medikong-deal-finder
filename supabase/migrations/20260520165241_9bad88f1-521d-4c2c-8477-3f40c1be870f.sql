-- Trigger: sync vendors.is_verified with validation_status
CREATE OR REPLACE FUNCTION public.sync_vendor_is_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_verified := (NEW.validation_status = 'approved');
    RETURN NEW;
  END IF;

  IF NEW.validation_status IS DISTINCT FROM OLD.validation_status THEN
    IF NEW.validation_status = 'approved' THEN
      NEW.is_verified := true;
    ELSE
      NEW.is_verified := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vendor_is_verified ON public.vendors;
CREATE TRIGGER trg_sync_vendor_is_verified
BEFORE INSERT OR UPDATE OF validation_status ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.sync_vendor_is_verified();

-- Backfill: align existing rows
UPDATE public.vendors
SET is_verified = true
WHERE validation_status = 'approved' AND is_verified IS DISTINCT FROM true;

UPDATE public.vendors
SET is_verified = false
WHERE validation_status IS DISTINCT FROM 'approved' AND is_verified IS DISTINCT FROM false;
