-- 1. Colonnes TVA figées ------------------------------------------------------
ALTER TABLE public.affiliate_payout_invoices
  ADD COLUMN IF NOT EXISTS vat_rate_bp int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ttc_cents int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.affiliate_payout_invoices.vat_rate_bp IS
  'Taux de TVA appliqué, en points de base (2100 = 21 %). Figé à l''émission.';
COMMENT ON COLUMN public.affiliate_payout_invoices.vat_cents IS
  'Montant de TVA en cents, figé à l''émission. Arrondi au cent le plus proche (ROUND half-up).';

-- 2. Helper de calcul (règle unique serveur) ----------------------------------
CREATE OR REPLACE FUNCTION public.affiliate_payout_vat(_total_cents int, _vat_mode text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  -- none / reverse_charge : hors champ ou autoliquidation => 0
  -- vat_21               : 21 % du total HT, arrondi au cent le plus proche
  SELECT jsonb_build_object(
    'vat_rate_bp', CASE WHEN _vat_mode = 'vat_21' THEN 2100 ELSE 0 END,
    'vat_cents',   CASE WHEN _vat_mode = 'vat_21'
                        THEN ROUND(COALESCE(_total_cents, 0) * 2100 / 10000.0)::int
                        ELSE 0 END
  );
$$;

-- 3. Backfill des factures déjà émises ---------------------------------------
UPDATE public.affiliate_payout_invoices pi
   SET vat_rate_bp = (public.affiliate_payout_vat(pi.total_cents, pi.vat_mode)->>'vat_rate_bp')::int,
       vat_cents   = (public.affiliate_payout_vat(pi.total_cents, pi.vat_mode)->>'vat_cents')::int,
       total_ttc_cents = pi.total_cents
                         + (public.affiliate_payout_vat(pi.total_cents, pi.vat_mode)->>'vat_cents')::int;

-- 4. Émission : figer la TVA -------------------------------------------------
CREATE OR REPLACE FUNCTION public.affiliate_generate_monthly_payouts(_period_start date DEFAULT NULL::date, _period_end date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start date := COALESCE(_period_start, (date_trunc('month', now()) - interval '1 month')::date);
  v_end   date := COALESCE(_period_end, (date_trunc('month', now()) - interval '1 day')::date);
  v_aff   record;
  v_rule  public.affiliate_commission_rules%ROWTYPE;
  v_total int;
  v_inv   uuid;
  v_created int := 0;
  v_skipped int := 0;
  v_mode  text;
  v_vat   jsonb;
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  FOR v_aff IN SELECT * FROM public.affiliates WHERE status = 'active' LOOP
    IF EXISTS (SELECT 1 FROM public.affiliate_payout_invoices
                WHERE affiliate_id = v_aff.id AND period_start = v_start AND period_end = v_end) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(commission_cents), 0) INTO v_total
      FROM public.affiliate_commissions
     WHERE affiliate_id = v_aff.id AND status = 'validated';

    v_rule := public.affiliate_resolve_rule(v_aff.id);

    IF v_total < COALESCE(v_rule.payout_threshold_cents, 5000) OR v_total <= 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_mode := CASE WHEN v_aff.vat_number IS NOT NULL THEN 'reverse_charge' ELSE 'none' END;
    v_vat  := public.affiliate_payout_vat(v_total, v_mode);

    INSERT INTO public.affiliate_payout_invoices (
      affiliate_id, invoice_number, period_start, period_end, total_cents,
      vat_mode, vat_rate_bp, vat_cents, total_ttc_cents, status, issued_at)
    VALUES (
      v_aff.id, public.generate_document_number('affiliate_payout'), v_start, v_end, v_total,
      v_mode,
      (v_vat->>'vat_rate_bp')::int,
      (v_vat->>'vat_cents')::int,
      v_total + (v_vat->>'vat_cents')::int,
      'issued', now())
    RETURNING id INTO v_inv;

    UPDATE public.affiliate_commissions
       SET status = 'invoiced', payout_invoice_id = v_inv, updated_at = now()
     WHERE affiliate_id = v_aff.id AND status = 'validated';

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'skipped', v_skipped,
                            'period_start', v_start, 'period_end', v_end);
END;
$function$;

-- 5. RPC portail : exposer la TVA stockée ------------------------------------
DROP FUNCTION IF EXISTS public.affiliate_my_payouts(uuid);
CREATE OR REPLACE FUNCTION public.affiliate_my_payouts(_affiliate_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, invoice_number text, period_start date, period_end date, total_cents integer,
              vat_mode text, vat_rate_bp integer, vat_cents integer, total_ttc_cents integer,
              status text, pdf_path text, issued_at timestamp with time zone, paid_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_aff uuid;
BEGIN
  v_aff := public.affiliate_target_id(_affiliate_id);
  RETURN QUERY
  SELECT pi.id, pi.invoice_number, pi.period_start, pi.period_end, pi.total_cents,
         pi.vat_mode, pi.vat_rate_bp, pi.vat_cents, pi.total_ttc_cents,
         pi.status, pi.pdf_path, pi.issued_at, pi.paid_at
  FROM public.affiliate_payout_invoices pi
  WHERE pi.affiliate_id = v_aff
  ORDER BY pi.period_start DESC;
END;
$function$;

-- 6. Lecture admin du dernier run des crons ----------------------------------
CREATE OR REPLACE FUNCTION public.affiliate_cron_last_runs()
RETURNS TABLE(jobname text, schedule text, last_start timestamp with time zone,
              last_end timestamp with time zone, last_status text, last_message text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO public, cron
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;
  RETURN QUERY
  SELECT j.jobname::text, j.schedule::text, d.start_time, d.end_time,
         d.status::text, left(COALESCE(d.return_message, ''), 500)
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT * FROM cron.job_run_details r
    WHERE r.jobid = j.jobid
    ORDER BY r.start_time DESC NULLS LAST
    LIMIT 1
  ) d ON true
  WHERE j.jobname IN ('affiliate-validate-daily', 'affiliate-payout-monthly')
  ORDER BY j.jobname;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_cron_last_runs() TO authenticated;

-- 7. Planification pg_cron ---------------------------------------------------
-- pg_cron planifie en UTC. On fixe des heures UTC constantes plutôt que de
-- gérer le DST : 02:00 UTC = 03:00 Brussels en hiver / 04:00 en été,
-- 03:00 UTC = 04:00 Brussels en hiver / 05:00 en été. Créneaux nocturnes,
-- aucun impact fonctionnel ; les fonctions appelées sont idempotentes.
SELECT cron.unschedule('affiliate-validate-daily')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'affiliate-validate-daily');
SELECT cron.unschedule('affiliate-payout-monthly')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'affiliate-payout-monthly');

SELECT cron.schedule(
  'affiliate-validate-daily',
  '0 2 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/affiliate-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1)
    ),
    body := jsonb_build_object('action', 'validate', 'source', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);

SELECT cron.schedule(
  'affiliate-payout-monthly',
  '0 3 1 * *',
  $cron$
  SELECT net.http_post(
    url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/affiliate-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1)
    ),
    body := jsonb_build_object('action', 'monthly_payout', 'source', 'cron'),
    timeout_milliseconds := 300000
  );
  $cron$
);