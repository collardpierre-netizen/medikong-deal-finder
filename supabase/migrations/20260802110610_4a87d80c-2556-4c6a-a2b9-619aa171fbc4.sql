CREATE OR REPLACE FUNCTION public.close_orphan_qogita_resync_logs(_stale_minutes integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.qogita_resync_logs
    SET status = 'partial',
        completed_at = now(),
        duration_ms = COALESCE(duration_ms, (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::bigint),
        error_message = COALESCE(error_message, 'interrompu (budget CPU) — cloturé par watchdog'),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('closed_by_watchdog_at', now())
    WHERE status = 'running'
      AND started_at < now() - make_interval(mins => GREATEST(_stale_minutes, 1))
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.close_orphan_qogita_resync_logs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_orphan_qogita_resync_logs(integer) TO service_role;

-- Clôture immédiate des runs actuellement orphelins
SELECT public.close_orphan_qogita_resync_logs(5);

SELECT cron.unschedule('qogita-resync-logs-watchdog')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'qogita-resync-logs-watchdog');

SELECT cron.schedule(
  'qogita-resync-logs-watchdog',
  '*/10 * * * *',
  $cron$ SELECT public.close_orphan_qogita_resync_logs(10); $cron$
);