CREATE OR REPLACE FUNCTION public.block_qogita_master_catchall()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
BEGIN
  SELECT slug INTO v_slug FROM public.vendors WHERE id = NEW.vendor_id;
  IF v_slug = 'qogita' THEN
    NEW.is_active := false;
    NEW.admin_hidden := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_qogita_master_catchall ON public.offers;
CREATE TRIGGER trg_block_qogita_master_catchall
BEFORE INSERT OR UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.block_qogita_master_catchall();