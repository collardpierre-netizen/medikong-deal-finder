-- 1. Option A : date de mandat Medista (date du jour, pas d'antidatation)
UPDATE public.vendors
   SET mandate_signed_at = COALESCE(mandate_signed_at, CURRENT_DATE)
 WHERE name = 'Medista NV';

-- 2. Fix du cast enum dans le watchdog
CREATE OR REPLACE FUNCTION public.finalize_orphan_qogita_resync_logs(_stale_minutes integer DEFAULT 30)
 RETURNS TABLE(finalized_id uuid, new_status text, products_processed integer, minutes_stuck integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.qogita_resync_logs l
     SET status = (CASE WHEN COALESCE(l.products_processed, 0) > 0 THEN 'partial' ELSE 'failed' END)::qogita_resync_status,
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
$function$;

-- 3. Clôture immédiate des runs orphelins déjà bloqués
SELECT public.finalize_orphan_qogita_resync_logs(30);