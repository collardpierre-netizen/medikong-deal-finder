-- LOT 2 : neutraliser les crons storefront "offres" (code conservé, fallback à la demande)
SELECT cron.unschedule('scrape-qogita-storefront-daily');
SELECT cron.unschedule('qogita-storefront-scrape-hourly');
SELECT cron.unschedule('qogita-storefront-catalog-wide');

-- LOT 1 : API Qogita = source primaire des offres/prix (toutes les 5 min)
SELECT cron.schedule(
  'qogita-offers-api-sync',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/sync-qogita-offers-api',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1)
    ),
    body := jsonb_build_object('source','cron','limit',150,'concurrency',8,'walltimeMs',150000,'freshHours',12),
    timeout_milliseconds := 180000
  );
  $cron$
);

-- Déclencheur manuel admin (utilisé pour les tests et le bouton admin)
CREATE OR REPLACE FUNCTION public.trigger_qogita_offers_api_sync(_body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $function$
DECLARE
  v_secret text;
  v_req_id bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'cron_shared_secret absent du vault';
  END IF;

  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/sync-qogita-offers-api',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_secret),
    body := COALESCE(_body, '{}'::jsonb),
    timeout_milliseconds := 180000
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.trigger_qogita_offers_api_sync(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_qogita_offers_api_sync(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_qogita_offers_api_sync(jsonb) TO service_role;