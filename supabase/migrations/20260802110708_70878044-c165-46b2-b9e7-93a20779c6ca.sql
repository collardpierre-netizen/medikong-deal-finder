SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'qogita-offers-api-sync'),
  command := $cron$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/sync-qogita-offers-api',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1)
    ),
    body := jsonb_build_object('source','cron','limit',60,'concurrency',4,'rps',2,'walltimeMs',55000,'freshHours',12),
    timeout_milliseconds := 90000
  );
  $cron$
);