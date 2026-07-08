
-- 1. Colonne + trigger de cohérence (créé AVANT le backfill)
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS country_codes text[] NOT NULL DEFAULT ARRAY['BE']::text[];

CREATE INDEX IF NOT EXISTS idx_offers_country_codes ON public.offers USING gin (country_codes);

CREATE OR REPLACE FUNCTION public.sync_offer_country_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  code text;
BEGIN
  IF NEW.country_codes IS NULL OR array_length(NEW.country_codes, 1) IS NULL THEN
    IF NEW.country_code IS NOT NULL AND NEW.country_code <> '' THEN
      NEW.country_codes := ARRAY[upper(NEW.country_code)];
    ELSE
      NEW.country_codes := ARRAY['BE'];
    END IF;
  ELSE
    NEW.country_codes := ARRAY(
      SELECT DISTINCT upper(c) FROM unnest(NEW.country_codes) c WHERE c IS NOT NULL AND c <> ''
    );
    IF array_length(NEW.country_codes, 1) IS NULL THEN
      NEW.country_codes := ARRAY['BE'];
    END IF;
  END IF;

  FOREACH code IN ARRAY NEW.country_codes LOOP
    IF code !~ '^[A-Z]{2}$' THEN
      RAISE EXCEPTION 'Invalid country code in offers.country_codes: %', code;
    END IF;
  END LOOP;

  NEW.country_code := NEW.country_codes[1];
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_offer_country_codes ON public.offers;
CREATE TRIGGER trg_sync_offer_country_codes
  BEFORE INSERT OR UPDATE OF country_code, country_codes ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.sync_offer_country_codes();

-- 2. Backfill batché, triggers user désactivés le temps de l'opération.
ALTER TABLE public.offers DISABLE TRIGGER USER;

DO $$
DECLARE
  batch_size int := 20000;
  updated int;
BEGIN
  LOOP
    WITH todo AS (
      SELECT id, country_code, country_codes
      FROM public.offers
      WHERE NOT ('BE' = ANY(country_codes))
         OR (country_code IS NOT NULL AND country_code <> '' AND NOT (upper(country_code) = ANY(country_codes)))
      LIMIT batch_size
    )
    UPDATE public.offers o
    SET country_codes = ARRAY(
      SELECT DISTINCT c FROM unnest(
        CASE
          WHEN todo.country_code IS NOT NULL AND todo.country_code <> ''
            THEN todo.country_codes || ARRAY[upper(todo.country_code), 'BE']
          ELSE todo.country_codes || ARRAY['BE']
        END
      ) c
      WHERE c IS NOT NULL AND c <> ''
    )
    FROM todo
    WHERE o.id = todo.id;

    GET DIAGNOSTICS updated = ROW_COUNT;
    EXIT WHEN updated = 0;
  END LOOP;
END $$;

ALTER TABLE public.offers ENABLE TRIGGER USER;
