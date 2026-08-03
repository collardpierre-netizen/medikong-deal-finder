SELECT cron.unschedule('qogita-repair-price-mapping') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'qogita-repair-price-mapping');

SELECT cron.schedule(
  'qogita-repair-price-mapping',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/qogita-repair-price-mapping',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret')
    ),
    body := jsonb_build_object('batchProducts', 50, 'rps', 3, 'concurrency', 4, 'walltimeMs', 50000),
    timeout_milliseconds := 55000
  );
  $$
);