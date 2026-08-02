SELECT cron.unschedule('qogita-catalog-ingest-watchdog')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'qogita-catalog-ingest-watchdog');

SELECT cron.schedule(
  'qogita-catalog-ingest-watchdog',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/qogita-catalog-ingest',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_shared_secret' LIMIT 1)
    ),
    body := jsonb_build_object('action','watchdog','limit',2),
    timeout_milliseconds := 20000
  );
  $cron$
);