SELECT cron.schedule(
  'qogita-price-history-backfill-priority',
  '*/2 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/scrape-qogita-price-history',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('mode','backfill','priorityOnly',true,'limit',40,'resourceOffers',false),
    timeout_milliseconds := 70000
  );
  $cron$
);

SELECT cron.schedule(
  'qogita-price-history-backfill-rest',
  '*/10 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/scrape-qogita-price-history',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('mode','backfill','priorityOnly',false,'limit',40,'resourceOffers',false),
    timeout_milliseconds := 70000
  );
  $cron$
);