CREATE OR REPLACE FUNCTION public.protect_profile_price_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.price_level_code IS DISTINCT FROM OLD.price_level_code THEN
    IF auth.uid() IS NULL THEN
      -- service_role / backend jobs (no JWT) are allowed
      RETURN NEW;
    END IF;
    IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
      RAISE EXCEPTION 'Le niveau tarifaire ne peut être modifié que par un administrateur';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_price_level ON public.profiles;
CREATE TRIGGER trg_protect_profile_price_level
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_price_level();