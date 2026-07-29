SELECT cron.unschedule('poll-peppol-status-hourly');

SELECT cron.schedule(
  'poll-peppol-status-hourly',
  '35 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/poll-peppol-status',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1
      )
    ),
    body := '{"source":"cron"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);