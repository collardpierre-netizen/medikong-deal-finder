DO $$
BEGIN
  PERFORM cron.unschedule('poll-peppol-status-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'poll-peppol-status-hourly',
  '35 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/poll-peppol-status',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_shared_secret', true)
    ),
    body := jsonb_build_object('source', 'cron', 'triggered_at', now())
  );
  $$
);