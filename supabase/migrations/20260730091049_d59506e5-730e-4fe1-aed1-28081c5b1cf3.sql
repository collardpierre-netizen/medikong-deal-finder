SELECT cron.unschedule('qogita-webhook-register-once');

SELECT cron.schedule(
  'qogita-catalog-bootstrap-once',
  '* * * * *',
  $cron$
  WITH s AS (
    SELECT decrypted_secret AS v FROM vault.decrypted_secrets WHERE name='cron_shared_secret' LIMIT 1
  )
  SELECT
    net.http_post(
      url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/qogita-catalog-request',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', s.v),
      body := jsonb_build_object('action','test','source','bootstrap'),
      timeout_milliseconds := 60000
    ),
    net.http_post(
      url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/qogita-catalog-request',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', s.v),
      body := jsonb_build_object('action','request','scope','priority_brands','source','bootstrap'),
      timeout_milliseconds := 120000
    )
  FROM s;
  $cron$
);