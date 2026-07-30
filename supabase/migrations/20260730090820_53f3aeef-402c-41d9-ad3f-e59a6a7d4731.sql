-- Déclencheur manuel admin (register / status / test / request)
CREATE OR REPLACE FUNCTION public.trigger_qogita_catalog_action(_body jsonb DEFAULT '{}'::jsonb)
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
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/qogita-catalog-request',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_secret),
    body := COALESCE(_body, '{}'::jsonb),
    timeout_milliseconds := 120000
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.trigger_qogita_catalog_action(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_qogita_catalog_action(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_qogita_catalog_action(jsonb) TO service_role;

-- Enregistrement one-shot du webhook (désactivé dès qu'il a réussi)
SELECT cron.schedule(
  'qogita-webhook-register-once',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/qogita-catalog-request',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_shared_secret' LIMIT 1)
    ),
    body := jsonb_build_object('action','register','source','cron-bootstrap'),
    timeout_milliseconds := 60000
  );
  $cron$
);

-- Export quotidien filtré marques prioritaires
SELECT cron.schedule(
  'qogita-catalog-priority-daily',
  '20 4 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/qogita-catalog-request',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_shared_secret' LIMIT 1)
    ),
    body := jsonb_build_object('action','request','scope','priority_brands','source','cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);

-- Export complet hebdomadaire
SELECT cron.schedule(
  'qogita-catalog-full-weekly',
  '40 3 * * 0',
  $cron$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/qogita-catalog-request',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_shared_secret' LIMIT 1)
    ),
    body := jsonb_build_object('action','request','scope','full','source','cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);