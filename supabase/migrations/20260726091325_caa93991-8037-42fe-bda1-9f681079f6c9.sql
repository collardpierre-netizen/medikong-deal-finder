
CREATE OR REPLACE FUNCTION public.close_stale_qogita_resync_logs(_older_than interval DEFAULT interval '1 hour')
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_count int;
BEGIN
  UPDATE public.qogita_resync_logs
     SET status = 'failed'::qogita_resync_status,
         completed_at = COALESCE(completed_at, now()),
         duration_ms = COALESCE(duration_ms, (extract(epoch FROM (now() - started_at)) * 1000)::int),
         error_message = COALESCE(error_message, 'auto-closed by watchdog (>1h running)')
   WHERE status = 'running'::qogita_resync_status
     AND started_at < now() - _older_than;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.close_stale_qogita_resync_logs(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_stale_qogita_resync_logs(interval) TO service_role;
