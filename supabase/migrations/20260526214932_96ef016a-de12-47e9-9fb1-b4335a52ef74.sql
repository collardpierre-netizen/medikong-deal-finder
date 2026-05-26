
-- Generate and store a long-random cron shared secret in vault
DO $$
DECLARE
  v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_shared_secret') THEN
    v_secret := encode(gen_random_bytes(48), 'hex');
    PERFORM vault.create_secret(v_secret, 'cron_shared_secret', 'Shared secret used by pg_cron to authenticate internal Edge Function jobs');
  END IF;
END $$;

-- SECURITY DEFINER validator callable by edge functions via PostgREST.
CREATE OR REPLACE FUNCTION public.validate_cron_secret(_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_stored text;
BEGIN
  IF _secret IS NULL OR length(_secret) < 32 THEN
    RETURN false;
  END IF;
  SELECT decrypted_secret INTO v_stored
  FROM vault.decrypted_secrets
  WHERE name = 'cron_shared_secret'
  LIMIT 1;
  IF v_stored IS NULL THEN
    RETURN false;
  END IF;
  -- timing-resistant compare
  RETURN length(_secret) = length(v_stored)
     AND hashtextextended(_secret, 0) = hashtextextended(v_stored, 0)
     AND _secret = v_stored;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_cron_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_cron_secret(text) TO anon, authenticated, service_role;
