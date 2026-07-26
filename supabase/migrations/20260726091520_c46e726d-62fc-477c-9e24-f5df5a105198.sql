
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

    EXIT WHEN v_batch_last IS NULL;
    v_cursor := v_batch_last;

    EXIT WHEN extract(epoch FROM clock_timestamp() - v_start) > 28;
  END LOOP;

  SELECT count(*) INTO v_stale_pending
  FROM public.offers
  WHERE is_qogita_backed=true AND is_active=true AND price_stale IS TRUE;

  INSERT INTO public.sync_logs (sync_type, status, progress_message, stats, completed_at)
  VALUES (
    'manual', 'completed'::sync_log_status,
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
