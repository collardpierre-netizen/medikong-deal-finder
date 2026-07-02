-- Watchdog: finalise les logs qogita_resync_logs bloqués en 'running' depuis > 30 min
CREATE OR REPLACE FUNCTION public.finalize_orphan_qogita_resync_logs(_stale_minutes int DEFAULT 30)
RETURNS TABLE(finalized_id uuid, new_status text, products_processed int, minutes_stuck int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.qogita_resync_logs l
     SET status = CASE WHEN COALESCE(l.products_processed, 0) > 0 THEN 'partial' ELSE 'failed' END,
         completed_at = now(),
         error_message = COALESCE(l.error_message, '') ||
           CASE WHEN l.error_message IS NULL OR l.error_message = '' THEN '' ELSE E'\n' END ||
           format('[watchdog] auto-finalised after %s min stuck in running (started_at=%s)',
                  EXTRACT(EPOCH FROM (now() - l.started_at))::int / 60,
                  l.started_at)
   WHERE l.status = 'running'
     AND l.started_at < now() - make_interval(mins => _stale_minutes)
  RETURNING l.id,
            (CASE WHEN COALESCE(l.products_processed, 0) > 0 THEN 'partial' ELSE 'failed' END)::text,
            COALESCE(l.products_processed, 0)::int,
            (EXTRACT(EPOCH FROM (now() - l.started_at))::int / 60)::int;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_orphan_qogita_resync_logs(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_orphan_qogita_resync_logs(int) TO service_role;

-- Cron: toutes les 15 min
DO $$
DECLARE _existing bigint;
BEGIN
  SELECT jobid INTO _existing FROM cron.job WHERE jobname = 'qogita-resync-orphan-watchdog';
  IF _existing IS NOT NULL THEN
    PERFORM cron.unschedule(_existing);
  END IF;
END $$;

SELECT cron.schedule(
  'qogita-resync-orphan-watchdog',
  '*/15 * * * *',
  $$SELECT public.finalize_orphan_qogita_resync_logs(30);$$
);