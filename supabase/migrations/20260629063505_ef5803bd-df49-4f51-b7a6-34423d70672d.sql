
-- Retention cleanup for anonymous savings_simulations (PII: email, ip, user_agent)
CREATE OR REPLACE FUNCTION public.purge_anonymous_savings_simulations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH del AS (
    DELETE FROM public.savings_simulations
    WHERE user_id IS NULL
      AND created_at < (now() - interval '12 months')
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM del;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_anonymous_savings_simulations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_anonymous_savings_simulations() TO service_role;

-- Schedule daily at 03:30 UTC via pg_cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job WHERE jobname = 'purge-anonymous-savings-simulations-daily';
    PERFORM cron.schedule(
      'purge-anonymous-savings-simulations-daily',
      '30 3 * * *',
      $cron$ SELECT public.purge_anonymous_savings_simulations(); $cron$
    );
  END IF;
END $$;
