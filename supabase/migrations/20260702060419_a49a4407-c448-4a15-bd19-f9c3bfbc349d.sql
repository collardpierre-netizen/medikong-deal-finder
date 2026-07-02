CREATE OR REPLACE FUNCTION public.qogita_watchdog_run(_stale_minutes int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _finalized jsonb;
  _finalized_count int := 0;
  _failed_count int := 0;
  _partial_count int := 0;
  _cron_secret text;
  _base_url text := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1';
  _sweep_req_id bigint := NULL;
  _stale_req_id bigint := NULL;
  _triggered_recovery boolean := false;
  _log_id uuid;
BEGIN
  -- 1. Finalise orphelins
  WITH rows AS (
    SELECT * FROM public.finalize_orphan_qogita_resync_logs(_stale_minutes)
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(rows.*)), '[]'::jsonb),
    count(*)::int,
    count(*) FILTER (WHERE new_status = 'failed')::int,
    count(*) FILTER (WHERE new_status = 'partial')::int
  INTO _finalized, _finalized_count, _failed_count, _partial_count
  FROM rows;

  -- 2. Si au moins un run a été finalisé en 'failed' → déclencher recovery
  IF _failed_count > 0 THEN
    SELECT decrypted_secret INTO _cron_secret
      FROM vault.decrypted_secrets
     WHERE name = 'cron_shared_secret'
     LIMIT 1;

    IF _cron_secret IS NOT NULL THEN
      -- a) sweep de réconciliation (désactivation produits fantômes)
      SELECT net.http_post(
        url := _base_url || '/qogita-reconcile',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', _cron_secret
        ),
        body := jsonb_build_object('sweep', 'staleness', 'threshold_days', 7, 'dry_run', false)
      ) INTO _sweep_req_id;

      -- b) relance contrôlée de la chaîne (500 produits)
      SELECT net.http_post(
        url := _base_url || '/run-sync-pipeline',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', _cron_secret
        ),
        body := jsonb_build_object(
          'country', 'BE',
          'triggeredBy', 'watchdog-recovery',
          'mode', 'daily_stale_refresh',
          'batchSize', 500
        )
      ) INTO _stale_req_id;

      _triggered_recovery := true;
    END IF;
  END IF;

  -- 3. Trace
  INSERT INTO public.sync_logs (sync_type, status, records_processed, error_message, metadata)
  VALUES (
    'qogita_watchdog',
    CASE WHEN _finalized_count = 0 THEN 'success' WHEN _failed_count > 0 THEN 'partial' ELSE 'success' END,
    _finalized_count,
    NULL,
    jsonb_build_object(
      'stale_minutes', _stale_minutes,
      'finalized_total', _finalized_count,
      'finalized_failed', _failed_count,
      'finalized_partial', _partial_count,
      'triggered_recovery', _triggered_recovery,
      'sweep_request_id', _sweep_req_id,
      'stale_refresh_request_id', _stale_req_id,
      'finalized', _finalized
    )
  )
  RETURNING id INTO _log_id;

  RETURN jsonb_build_object(
    'log_id', _log_id,
    'finalized_total', _finalized_count,
    'finalized_failed', _failed_count,
    'finalized_partial', _partial_count,
    'triggered_recovery', _triggered_recovery,
    'sweep_request_id', _sweep_req_id,
    'stale_refresh_request_id', _stale_req_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qogita_watchdog_run(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qogita_watchdog_run(int) TO service_role;

-- Admin wrapper pour appel manuel depuis l'UI
CREATE OR REPLACE FUNCTION public.admin_qogita_watchdog_run(_stale_minutes int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF _stale_minutes IS NULL OR _stale_minutes < 1 THEN
    RAISE EXCEPTION 'invalid_stale_minutes' USING ERRCODE = '22023';
  END IF;
  RETURN public.qogita_watchdog_run(_stale_minutes);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_qogita_watchdog_run(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_qogita_watchdog_run(int) TO authenticated;

-- Réécrire le cron pour utiliser la nouvelle logique (au lieu du simple finalize)
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
  $$SELECT public.qogita_watchdog_run(30);$$
);