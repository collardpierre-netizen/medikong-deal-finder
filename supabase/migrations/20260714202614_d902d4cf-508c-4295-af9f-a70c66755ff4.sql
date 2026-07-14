
ALTER TABLE public.search_logs
  ADD COLUMN IF NOT EXISTS profession_type_id uuid NULL,
  ADD COLUMN IF NOT EXISTS buyer_profile_id text NULL,
  ADD COLUMN IF NOT EXISTS profile_country text NULL,
  ADD COLUMN IF NOT EXISTS profile_region text NULL,
  ADD COLUMN IF NOT EXISTS profile_sector text NULL;

CREATE INDEX IF NOT EXISTS search_logs_profession_type_idx ON public.search_logs (profession_type_id);
CREATE INDEX IF NOT EXISTS search_logs_buyer_profile_idx  ON public.search_logs (buyer_profile_id);
CREATE INDEX IF NOT EXISTS search_logs_profile_country_idx ON public.search_logs (profile_country);

CREATE OR REPLACE FUNCTION public.search_logs_enrich_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profession uuid;
  v_buyer_profile text;
  v_country text;
  v_sector text;
  v_region text;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT p.profession_type_id, p.buyer_profile_id, p.country, p.sector
      INTO v_profession, v_buyer_profile, v_country, v_sector
      FROM public.profiles p
      WHERE p.user_id = NEW.user_id
      LIMIT 1;

    SELECT b.region
      INTO v_region
      FROM public.buyers b
      WHERE b.user_id = NEW.user_id
      LIMIT 1;

    NEW.profession_type_id := COALESCE(NEW.profession_type_id, v_profession);
    NEW.buyer_profile_id   := COALESCE(NEW.buyer_profile_id,   v_buyer_profile);
    NEW.profile_country    := COALESCE(NEW.profile_country,    v_country);
    NEW.profile_sector     := COALESCE(NEW.profile_sector,     v_sector);
    NEW.profile_region     := COALESCE(NEW.profile_region,     v_region);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_search_logs_enrich_profile ON public.search_logs;
CREATE TRIGGER trg_search_logs_enrich_profile
  BEFORE INSERT ON public.search_logs
  FOR EACH ROW EXECUTE FUNCTION public.search_logs_enrich_profile();

UPDATE public.search_logs sl
SET profession_type_id = p.profession_type_id,
    buyer_profile_id   = p.buyer_profile_id,
    profile_country    = p.country,
    profile_sector     = p.sector
FROM public.profiles p
WHERE sl.user_id = p.user_id
  AND (sl.profession_type_id IS NULL OR sl.buyer_profile_id IS NULL OR sl.profile_country IS NULL);

UPDATE public.search_logs sl
SET profile_region = b.region
FROM public.buyers b
WHERE sl.user_id = b.user_id
  AND sl.profile_region IS NULL;
