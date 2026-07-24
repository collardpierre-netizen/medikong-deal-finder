-- P1-b — Watchdog Qogita : fréquence 15 min → 5 min, seuil 30 min → 10 min.
-- Avant : un run mort n'était nettoyé qu'au bout de 30 min (fréquence x seuil).
-- Maintenant : détection ~10 min max, conforme à PIPELINE_HEARTBEAT_STALE_MINUTES.
SELECT cron.unschedule('qogita-resync-orphan-watchdog');
SELECT cron.schedule(
  'qogita-resync-orphan-watchdog',
  '*/5 * * * *',
  $$SELECT public.qogita_watchdog_run(10);$$
);