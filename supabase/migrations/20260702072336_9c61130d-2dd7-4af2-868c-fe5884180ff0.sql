
-- 1) Colonne tier
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS qogita_sync_tier char(1) NOT NULL DEFAULT 'B';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_qogita_sync_tier_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_qogita_sync_tier_check
      CHECK (qogita_sync_tier IN ('A','B','C'));
  END IF;
END $$;

-- 2) Index pour sélection tier + fraîcheur
CREATE INDEX IF NOT EXISTS idx_products_qogita_fast_refresh
  ON public.products (qogita_sync_tier, synced_at)
  WHERE is_active = true AND qogita_fid IS NOT NULL;

-- 3) Recompute tiers based on 30d orders + popularity
CREATE OR REPLACE FUNCTION public.recompute_qogita_sync_tiers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a int; v_b int; v_c int;
BEGIN
  WITH pop AS (
    SELECT id,
           NTILE(10) OVER (ORDER BY COALESCE(popularity, 0) DESC) AS bucket
    FROM public.products
    WHERE is_active = true AND qogita_qid IS NOT NULL
  ),
  recent_ordered AS (
    SELECT DISTINCT ol.product_id AS id
    FROM public.order_lines ol
    JOIN public.orders o ON o.id = ol.order_id
    WHERE o.created_at > now() - interval '30 days'
      AND ol.product_id IS NOT NULL
  )
  UPDATE public.products p
  SET qogita_sync_tier = CASE
    WHEN p.id IN (SELECT id FROM recent_ordered) THEN 'A'
    WHEN p.id IN (SELECT id FROM pop WHERE bucket = 1) THEN 'A'
    WHEN p.id IN (SELECT id FROM pop WHERE bucket <= 5) THEN 'B'
    ELSE 'C'
  END
  WHERE p.is_active = true AND p.qogita_qid IS NOT NULL;

  SELECT
    count(*) FILTER (WHERE qogita_sync_tier='A'),
    count(*) FILTER (WHERE qogita_sync_tier='B'),
    count(*) FILTER (WHERE qogita_sync_tier='C')
  INTO v_a, v_b, v_c
  FROM public.products
  WHERE is_active=true AND qogita_qid IS NOT NULL;

  RETURN jsonb_build_object(
    'tier_a', v_a, 'tier_b', v_b, 'tier_c', v_c,
    'recomputed_at', now()
  );
END $$;

-- 4) Enqueue fast refresh batch for a tier
CREATE OR REPLACE FUNCTION public.enqueue_qogita_fast_refresh_batch(
  _tier char(1) DEFAULT 'A',
  _batch_size integer DEFAULT 200,
  _max_age_hours integer DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota jsonb;
  v_log_id uuid;
  v_product_ids uuid[] := ARRAY[]::uuid[];
  v_count integer := 0;
BEGIN
  IF _tier NOT IN ('A','B','C') THEN
    RAISE EXCEPTION 'invalid tier %', _tier;
  END IF;

  v_quota := public.consume_qogita_tokens(_batch_size);
  IF NOT (v_quota->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'enqueued', 0, 'rate_limited', true,
      'tier', _tier, 'available', v_quota->>'available',
      'product_ids', jsonb_build_array()
    );
  END IF;

  INSERT INTO public.qogita_resync_logs (mode, status, triggered_by, country_code, products_targeted, metadata)
  VALUES ('daily_stale_refresh', 'running', 'cron-tier-' || _tier, 'BE', _batch_size,
          jsonb_build_object('tier', _tier, 'fast_mode', true, 'max_age_hours', _max_age_hours))
  RETURNING id INTO v_log_id;

  WITH batch AS (
    SELECT p.id
    FROM public.products p
    WHERE p.is_active = true
      AND p.qogita_fid IS NOT NULL
      AND p.slug IS NOT NULL
      AND p.qogita_sync_tier = _tier
      AND (p.synced_at IS NULL OR p.synced_at < now() - make_interval(hours => _max_age_hours))
      AND EXISTS (
        SELECT 1 FROM public.offers o
        WHERE o.product_id = p.id
          AND o.is_qogita_backed = true
          AND o.is_active = true
      )
    ORDER BY p.synced_at NULLS FIRST
    LIMIT _batch_size
  )
  SELECT count(*)::integer, COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_count, v_product_ids
  FROM batch;

  UPDATE public.qogita_resync_logs
  SET products_targeted = v_count,
      metadata = metadata || jsonb_build_object('product_ids', to_jsonb(v_product_ids), 'quota', v_quota)
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'enqueued', v_count,
    'rate_limited', false,
    'tier', _tier,
    'log_id', v_log_id,
    'product_ids', to_jsonb(v_product_ids),
    'quota', v_quota
  );
END $$;

-- 5) Cron jobs
DO $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='cron_shared_secret' LIMIT 1;

  -- Unschedule previous versions if they exist
  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN (
     'qogita-tier-recompute-daily',
     'qogita-fast-refresh-tier-a',
     'qogita-fast-refresh-tier-b',
     'qogita-fast-refresh-tier-c'
   );

  -- Nightly tier recompute (03:30 UTC)
  PERFORM cron.schedule(
    'qogita-tier-recompute-daily',
    '30 3 * * *',
    $cron$SELECT public.recompute_qogita_sync_tiers();$cron$
  );

  -- Tier A: every 2h
  PERFORM cron.schedule(
    'qogita-fast-refresh-tier-a',
    '15 */2 * * *',
    format($cron$
      SELECT net.http_post(
        url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/run-sync-pipeline',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{"country":"BE","triggeredBy":"cron","mode":"fast_tier_refresh","tier":"A","batchSize":150,"maxAgeHours":2}'::jsonb
      ) AS request_id;
    $cron$, v_secret)
  );

  -- Tier B: every 6h
  PERFORM cron.schedule(
    'qogita-fast-refresh-tier-b',
    '25 */6 * * *',
    format($cron$
      SELECT net.http_post(
        url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/run-sync-pipeline',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{"country":"BE","triggeredBy":"cron","mode":"fast_tier_refresh","tier":"B","batchSize":250,"maxAgeHours":12}'::jsonb
      ) AS request_id;
    $cron$, v_secret)
  );

  -- Tier C: weekly Sunday 04:00
  PERFORM cron.schedule(
    'qogita-fast-refresh-tier-c',
    '0 4 * * 0',
    format($cron$
      SELECT net.http_post(
        url := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/run-sync-pipeline',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{"country":"BE","triggeredBy":"cron","mode":"fast_tier_refresh","tier":"C","batchSize":500,"maxAgeHours":168}'::jsonb
      ) AS request_id;
    $cron$, v_secret)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.recompute_qogita_sync_tiers() TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_qogita_fast_refresh_batch(char, integer, integer) TO service_role;
