-- Trigger défensif : interdit les colonnes wholesale sur les sources retail B2C (online).
CREATE OR REPLACE FUNCTION public.strip_wholesale_fields_for_b2c_sources()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_type TEXT;
BEGIN
  SELECT source_type INTO v_source_type
  FROM public.market_price_sources
  WHERE id = NEW.source_id;

  IF v_source_type = 'online' THEN
    NEW.prix_grossiste := NULL;
    NEW.prix_pharmacien := NULL;
    NEW.supplier_name := NULL;
    NEW.supplier_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_strip_wholesale_fields_for_b2c ON public.market_prices;
CREATE TRIGGER trg_strip_wholesale_fields_for_b2c
BEFORE INSERT OR UPDATE ON public.market_prices
FOR EACH ROW
EXECUTE FUNCTION public.strip_wholesale_fields_for_b2c_sources();