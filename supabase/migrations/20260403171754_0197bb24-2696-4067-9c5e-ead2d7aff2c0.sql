-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Daily incremental sync at 3:00 AM UTC
SELECT cron.schedule(
  'qogita-daily-incremental',
  '0 3 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/run-sync-pipeline',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
    ),
    body := '{"country":"BE","triggeredBy":"cron","mode":"incremental"}'::jsonb
  );
  $$
);

-- Weekly full CSV sync on Sundays at 4:00 AM UTC
SELECT cron.schedule(
  'qogita-weekly-full',
  '0 4 * * 0',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/run-sync-pipeline',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
    ),
    body := '{"country":"BE","triggeredBy":"cron","mode":"full"}'::jsonb
  );
  $$
);