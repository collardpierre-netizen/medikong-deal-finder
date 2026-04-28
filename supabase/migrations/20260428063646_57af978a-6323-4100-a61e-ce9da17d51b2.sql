CREATE OR REPLACE FUNCTION public.recompute_brand_top20_with_log()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id uuid;
  v_started timestamptz := now();
  v_top20_count int := 0;
  v_total_brands int := 0;
BEGIN
  INSERT INTO public.sync_logs (sync_type, status, started_at, progress_message)
  VALUES ('brands'::sync_type_enum, 'running'::sync_log_status, v_started, 'recompute_brand_top20 démarré')
  RETURNING id INTO v_log_id;

  BEGIN
    PERFORM public.recompute_brand_top20();

    SELECT COUNT(*) INTO v_top20_count FROM public.brands WHERE is_top20 = true;
    SELECT COUNT(*) INTO v_total_brands FROM public.brands;

    UPDATE public.sync_logs
    SET status = 'completed'::sync_log_status,
        completed_at = now(),
        progress_current = v_top20_count,
        progress_total = v_total_brands,
        progress_message = format('Top 20 recalculé : %s marques marquées top20 sur %s', v_top20_count, v_total_brands),
        stats = jsonb_build_object(
          'top20_count', v_top20_count,
          'total_brands', v_total_brands,
          'duration_ms', EXTRACT(EPOCH FROM (now() - v_started))::int * 1000,
          'job', 'recompute_brand_top20'
        )
    WHERE id = v_log_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.sync_logs
    SET status = 'error'::sync_log_status,
        completed_at = now(),
        error_message = SQLERRM,
        stats = jsonb_build_object(
          'duration_ms', EXTRACT(EPOCH FROM (now() - v_started))::int * 1000,
          'job', 'recompute_brand_top20',
          'sqlstate', SQLSTATE
        )
    WHERE id = v_log_id;
    RAISE;
  END;

  RETURN v_log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_brand_top20_with_log() FROM PUBLIC, anon, authenticated;