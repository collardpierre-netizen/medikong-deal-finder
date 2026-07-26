
-- 1) Batch recalc function for Qogita-backed offers (flat 25% + config override).
--    Keyset-paged via _last_id, safe under statement_timeout at _limit<=5000.
--    Never touches price_stale offers. Writes price_source='qogita_margin_recalc'
--    (the audit trail expected by admin dashboards).
CREATE OR REPLACE FUNCTION public.recalc_qogita_offers_batch(
  _last_id uuid DEFAULT NULL,
  _limit int DEFAULT 2000
)
RETURNS TABLE(updated int, last_id uuid, remaining bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_margin numeric := 25.0;
  v_updated int := 0;
  v_last uuid := _last_id;
  v_remaining bigint := 0;
BEGIN
  SELECT COALESCE((SELECT (value)::numeric FROM public.qogita_config WHERE key='margin_percentage'), 25.0)
    INTO v_margin;

  WITH batch AS (
    SELECT o.id,
           o.qogita_base_price::numeric AS base,
           COALESCE(o.qogita_base_delay_days, 3) AS base_delay,
           COALESCE(o.vat_rate, 0)::numeric AS vat
    FROM public.offers o
    WHERE o.is_qogita_backed = true
      AND o.is_active = true
      AND (o.price_stale IS NOT TRUE)
      AND o.qogita_base_price IS NOT NULL
      AND o.qogita_base_price > 0
      AND (_last_id IS NULL OR o.id > _last_id)
    ORDER BY o.id
    LIMIT _limit
  ),
  upd AS (
    UPDATE public.offers o
    SET price_excl_vat = round( (b.base * (1 + v_margin/100))::numeric, 2),
        price_incl_vat = round( (b.base * (1 + v_margin/100) * (1 + b.vat/100))::numeric, 2),
        margin_amount = round( (b.base * (v_margin/100))::numeric, 2),
        applied_margin_percentage = v_margin,
        applied_margin_rule_id = NULL,
        delivery_days = b.base_delay + 2,
        price_source = 'qogita_margin_recalc',
        price_source_updated_at = now()
    FROM batch b
    WHERE o.id = b.id
    RETURNING o.id
  )
  SELECT count(*)::int, max(u.id) INTO v_updated, v_last FROM upd u;

  IF v_updated = 0 THEN
    v_last := NULL;  -- signal cursor exhausted
  END IF;

  SELECT count(*) INTO v_remaining
  FROM public.offers
  WHERE is_qogita_backed = true
    AND is_active = true
    AND price_stale IS NOT TRUE
    AND qogita_base_price > 0
    AND price_source IS DISTINCT FROM 'qogita_margin_recalc';

  RETURN QUERY SELECT v_updated, v_last, v_remaining;
END;
$fn$;

REVOKE ALL ON FUNCTION public.recalc_qogita_offers_batch(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalc_qogita_offers_batch(uuid, int) TO service_role;

-- 2) Loop driver: called from cron, runs several batches until walltime hit
--    or cursor exhausted. Bounded to ~30s per cron tick.
CREATE OR REPLACE FUNCTION public.recalc_qogita_offers_run(
  _max_batches int DEFAULT 15,
  _batch_size int DEFAULT 2000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cursor uuid := NULL;
  v_updated_total int := 0;
  v_batches int := 0;
  v_batch_updated int;
  v_batch_last uuid;
  v_remaining bigint;
  v_stale_pending bigint;
  v_start timestamptz := clock_timestamp();
BEGIN
  FOR i IN 1.._max_batches LOOP
    SELECT b.updated, b.last_id, b.remaining
      INTO v_batch_updated, v_batch_last, v_remaining
      FROM public.recalc_qogita_offers_batch(v_cursor, _batch_size) b;

    v_batches := v_batches + 1;
    v_updated_total := v_updated_total + COALESCE(v_batch_updated, 0);

    EXIT WHEN v_batch_last IS NULL;   -- no more rows to process
    v_cursor := v_batch_last;

    EXIT WHEN extract(epoch FROM clock_timestamp() - v_start) > 28;  -- walltime guard
  END LOOP;

  SELECT count(*) INTO v_stale_pending
  FROM public.offers
  WHERE is_qogita_backed=true AND is_active=true AND price_stale IS TRUE;

  INSERT INTO public.sync_logs (sync_type, status, progress_message, stats, completed_at)
  VALUES (
    'manual', 'success',
    format('recalc_qogita_offers_run: %s offres recalculées en %s batchs', v_updated_total, v_batches),
    jsonb_build_object(
      'updated', v_updated_total,
      'batches', v_batches,
      'remaining_not_stale', v_remaining,
      'awaiting_fresh_base_stale', v_stale_pending,
      'duration_ms', (extract(epoch FROM clock_timestamp() - v_start) * 1000)::int
    ),
    now()
  );

  RETURN jsonb_build_object(
    'updated', v_updated_total,
    'batches', v_batches,
    'remaining_not_stale', v_remaining,
    'awaiting_fresh_base_stale', v_stale_pending
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.recalc_qogita_offers_run(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalc_qogita_offers_run(int, int) TO service_role;

-- 3) Watchdog function to close zombie qogita_resync_logs > 1h.
CREATE OR REPLACE FUNCTION public.close_stale_qogita_resync_logs(_older_than interval DEFAULT interval '1 hour')
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_count int;
BEGIN
  UPDATE public.qogita_resync_logs
     SET status = 'stale',
         finished_at = COALESCE(finished_at, now()),
         error_message = COALESCE(error_message, 'auto-closed by watchdog (>1h running)')
   WHERE status = 'running'
     AND started_at < now() - _older_than;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.close_stale_qogita_resync_logs(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_stale_qogita_resync_logs(interval) TO service_role;
