SELECT cron.unschedule('qogita-daily-incremental');
SELECT cron.unschedule('qogita-weekly-full');

SELECT cron.schedule(
  'qogita-daily-incremental',
  '0 3,11,19 * * *',
  $$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/run-sync-pipeline',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlva3dxeGhocGJsY2JrcnhnY2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzcwMTMsImV4cCI6MjA5MDIxMzAxM30.lmlTxWccGY1SROndss39XwGLX_4clKMitLNga6jRp_w"}'::jsonb,
    body := '{"country":"BE","triggeredBy":"cron","mode":"incremental"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'qogita-weekly-full',
  '0 4 * * 0,3',
  $$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/run-sync-pipeline',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlva3dxeGhocGJsY2JrcnhnY2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzcwMTMsImV4cCI6MjA5MDIxMzAxM30.lmlTxWccGY1SROndss39XwGLX_4clKMitLNga6jRp_w"}'::jsonb,
    body := '{"country":"BE","triggeredBy":"cron","mode":"full"}'::jsonb
  ) AS request_id;
  $$
);