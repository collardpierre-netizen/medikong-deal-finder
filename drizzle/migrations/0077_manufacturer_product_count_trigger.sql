CREATE OR REPLACE FUNCTION public._tg_products_manufacturer_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ids uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN _ids := ARRAY[NEW.manufacturer_id];
  ELSIF TG_OP = 'DELETE' THEN _ids := ARRAY[OLD.manufacturer_id];
  ELSE
    IF NEW.manufacturer_id IS NOT DISTINCT FROM OLD.manufacturer_id
       AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN RETURN NEW; END IF;
    _ids := ARRAY[OLD.manufacturer_id, NEW.manufacturer_id];
  END IF;
  UPDATE public.manufacturers m
     SET product_count = (SELECT count(*) FROM public.products p WHERE p.manufacturer_id = m.id AND p.is_active = true)
   WHERE m.id = ANY(_ids);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_products_manufacturer_count ON public.products;
CREATE TRIGGER trg_products_manufacturer_count
AFTER INSERT OR DELETE OR UPDATE OF manufacturer_id, is_active ON public.products
FOR EACH ROW EXECUTE FUNCTION public._tg_products_manufacturer_count();

UPDATE public.manufacturers m
   SET product_count = s.n
  FROM (SELECT m2.id, (SELECT count(*) FROM public.products p WHERE p.manufacturer_id = m2.id AND p.is_active = true) n
          FROM public.manufacturers m2) s
 WHERE s.id = m.id AND m.product_count IS DISTINCT FROM s.n;