-- Suspension du cron de polling Peppol tant que Falco n'a pas confirmé la bonne route.
-- La route /v1/documents?limit=100 renvoie 404 sur l'API actuelle.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'poll-peppol-status-hourly') THEN
    PERFORM cron.unschedule('poll-peppol-status-hourly');
  END IF;
END$$;