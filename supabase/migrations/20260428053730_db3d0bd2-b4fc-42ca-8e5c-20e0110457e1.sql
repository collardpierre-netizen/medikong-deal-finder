CREATE OR REPLACE FUNCTION public.ensure_vendor_display_code_distinct()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.qogita_seller_alias IS NOT NULL
     AND NEW.display_code IS NOT NULL
     AND upper(NEW.display_code) = upper(NEW.qogita_seller_alias) THEN
    LOOP
      new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      attempts := attempts + 1;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.vendors
        WHERE display_code = new_code
           OR upper(qogita_seller_alias) = upper(new_code)
      ) OR attempts > 20;
    END LOOP;
    NEW.display_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_vendor_display_code_distinct ON public.vendors;
CREATE TRIGGER trg_ensure_vendor_display_code_distinct
BEFORE INSERT OR UPDATE OF display_code, qogita_seller_alias ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.ensure_vendor_display_code_distinct();