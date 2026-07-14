-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- SECURITY DEFINER helper: writes CRON_SHARED_SECRET into Vault via edge function
CREATE OR REPLACE FUNCTION public.upsert_cron_shared_secret(_name text, _secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _secret IS NULL OR length(_secret) < 16 THEN
    RAISE EXCEPTION 'secret too short';
  END IF;
  IF _name IS NULL OR length(_name) = 0 THEN
    RAISE EXCEPTION 'name required';
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = _name;
  IF v_id IS NULL THEN
    v_id := vault.create_secret(_secret, _name, 'Shared bearer secret consumed by pg_cron jobs to authenticate against edge functions');
  ELSE
    PERFORM vault.update_secret(v_id, _secret, _name, 'Shared bearer secret consumed by pg_cron jobs to authenticate against edge functions');
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_cron_shared_secret(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_cron_shared_secret(text, text) TO service_role;

-- Schedule (or reschedule) the retry-peppol-failed hourly cron job.
-- The bearer token is read from vault.decrypted_secrets at run time, so no
-- secret value is stored in the SQL itself.
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'retry-peppol-failed-hourly';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'retry-peppol-failed-hourly',
    '15 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/retry-peppol-failed',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'cron_shared_secret'
          LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
    $cron$
  );
END $$;