CREATE OR REPLACE FUNCTION public.qogita_sweep_stale_offers(_threshold_days integer DEFAULT 60, _dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ids uuid[];
  v_candidates uuid[];
  v_total int;
  v_dry boolean := _dry_run;
  v_res jsonb;
BEGIN
  IF _threshold_days IS NULL OR _threshold_days < 30 THEN
    RAISE EXCEPTION '_threshold_days must be >= 30';
  END IF;
  IF NOT public.qogita_offers_source_healthy() THEN
    v_dry := true;
  END IF;
  SELECT array_agg(vendor_id) INTO v_ids FROM public.qogita_backed_vendor_ids();
  IF v_ids IS NULL THEN
    RETURN jsonb_build_object('status','noop');
  END IF;
  SELECT array_agg(o.id) INTO v_candidates
  FROM public.offers o
  WHERE o.vendor_id = ANY(v_ids) AND o.is_active = true
    AND (o.synced_at IS NULL OR o.synced_at < now() - (_threshold_days || ' days')::interval);
  SELECT count(*) INTO v_total FROM public.offers WHERE vendor_id = ANY(v_ids) AND is_active = true;
  v_res := public._qogita_apply_sweep(
    'staleness_offers_only', NULL, _threshold_days, NULL,
    COALESCE(v_candidates, ARRAY[]::uuid[]), ARRAY[]::uuid[], ARRAY[]::uuid[],
    v_total, 0, 0, 0, v_dry
  );
  IF NOT v_dry AND v_res->>'status' = 'success' THEN
    BEGIN
      v_res := v_res || jsonb_build_object('vendors', public.qogita_sweep_empty_vendors(true));
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'qogita vendor sweep failed: %', SQLERRM;
      v_res := v_res || jsonb_build_object('vendors_error', SQLERRM);
    END;
  END IF;
  RETURN v_res;
END;
$function$;

CREATE OR REPLACE FUNCTION public.qogita_stale_backfill_batch(_threshold_days integer DEFAULT 60, _batch integer DEFAULT 3000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_n int;
BEGIN
  UPDATE public.offers SET is_active=false, stock_quantity=0, updated_at=now()
  WHERE id IN (
    SELECT o.id FROM public.offers o
    WHERE o.vendor_id IN (SELECT vendor_id FROM public.qogita_backed_vendor_ids())
      AND o.is_active
      AND (o.synced_at IS NULL OR o.synced_at < now() - (_threshold_days || ' days')::interval)
    LIMIT _batch);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    BEGIN
      PERFORM public.qogita_sweep_empty_vendors(false);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'qogita vendor sweep failed: %', SQLERRM;
    END;
    PERFORM cron.unschedule('qogita-stale-backfill-60d');
  END IF;
  RETURN v_n;
END;
$function$;