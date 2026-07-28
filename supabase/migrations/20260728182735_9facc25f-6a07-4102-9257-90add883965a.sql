SELECT cron.alter_job(
  195,
  command := $cmd$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/scrape-qogita-storefront',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlva3dxeGhocGJsY2JrcnhnY2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzcwMTMsImV4cCI6MjA5MDIxMzAxM30.lmlTxWccGY1SROndss39XwGLX_4clKMitLNga6jRp_w"}'::jsonb,
    body := jsonb_build_object('source','cron','mode','catalog_wide','limit',25,'walltimeMs',120000,'freshWindowHours',12,'resourceOffers',true)
  );
  $cmd$
);