CREATE OR REPLACE FUNCTION public.check_qogita_stale_refresh_alert()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_success timestamptz;
  v_hours_since numeric;
  v_recent_alert_count int;
BEGIN
  SELECT max(completed_at) INTO v_last_success
  FROM public.qogita_resync_logs
  WHERE mode = 'daily_stale_refresh'
    AND status IN ('success', 'completed');

  v_hours_since := CASE
    WHEN v_last_success IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (now() - v_last_success)) / 3600
  END;

  IF v_last_success IS NULL OR v_hours_since > 168 THEN
    SELECT count(*) INTO v_recent_alert_count
    FROM public.admin_notifications
    WHERE type = 'qogita_stale_refresh_down'
      AND created_at > now() - interval '24 hours';

    IF v_recent_alert_count = 0 THEN
      INSERT INTO public.admin_notifications (type, severity, title, body, cta_url, payload, source_type)
      VALUES (
        'qogita_stale_refresh_down',
        'critical',
        'Sync Qogita à l''arrêt',
        CASE
          WHEN v_last_success IS NULL THEN 'Aucun run daily_stale_refresh terminé avec succès. La synchro Qogita ne tourne plus.'
          ELSE 'Dernier run daily_stale_refresh réussi il y a ' || round(v_hours_since / 24, 1) || ' jours (seuil : 7 jours).'
        END,
        '/admin/qogita-status',
        jsonb_build_object(
          'last_success_at', v_last_success,
          'hours_since_last_success', v_hours_since,
          'threshold_hours', 168
        ),
        'qogita_sync_healthcheck'
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_qogita_stale_refresh_alert() FROM public;
GRANT EXECUTE ON FUNCTION public.check_qogita_stale_refresh_alert() TO service_role;