SELECT cron.schedule(
  'qogita-catalog-poll',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/qogita-catalog-request',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_shared_secret' LIMIT 1)
    ),
    body := jsonb_build_object('action','poll','limit',5,'source','cron')
  );
  $$
);