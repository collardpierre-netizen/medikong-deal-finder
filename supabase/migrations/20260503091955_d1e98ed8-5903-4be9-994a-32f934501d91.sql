ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS carton_size_override integer,
  ADD COLUMN IF NOT EXISTS packaging_languages text[];

ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_carton_size_override_chk;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_carton_size_override_chk
  CHECK (carton_size_override IS NULL OR (carton_size_override >= 1 AND carton_size_override <= 100000));

CREATE OR REPLACE FUNCTION public.validate_offer_packaging_languages()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  code text;
BEGIN
  IF NEW.packaging_languages IS NULL THEN
    RETURN NEW;
  END IF;
  IF array_length(NEW.packaging_languages, 1) > 12 THEN
    RAISE EXCEPTION 'packaging_languages: max 12 codes';
  END IF;
  FOREACH code IN ARRAY NEW.packaging_languages LOOP
    IF code !~ '^[a-z]{2}$' THEN
      RAISE EXCEPTION 'packaging_languages: code "%s" invalide (attendu ISO 639-1, 2 lettres minuscules)', code;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_offer_packaging_languages ON public.offers;
CREATE TRIGGER trg_validate_offer_packaging_languages
BEFORE INSERT OR UPDATE OF packaging_languages ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.validate_offer_packaging_languages();

COMMENT ON COLUMN public.offers.carton_size_override IS
  'Nombre d''unités de vente par carton (master case) saisi par le vendeur. NULL = inconnu.';
COMMENT ON COLUMN public.offers.packaging_languages IS
  'Codes ISO 639-1 (2 lettres minuscules) des langues présentes sur le packaging. Ex: {fr,nl,en}.';