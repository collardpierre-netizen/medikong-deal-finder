CREATE OR REPLACE FUNCTION public.sync_offer_country_codes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
    -- Dedup while preserving first-occurrence order (do NOT use SELECT DISTINCT which is unordered).
    NEW.country_codes := ARRAY(
      SELECT c FROM (
        SELECT upper(c) AS c, MIN(ord) AS ord
        FROM unnest(NEW.country_codes) WITH ORDINALITY AS t(c, ord)
        WHERE c IS NOT NULL AND c <> ''
        GROUP BY upper(c)
        ORDER BY MIN(ord)
      ) s
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
$function$;