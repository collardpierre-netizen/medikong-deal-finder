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
  RETURN public._qogita_apply_sweep(
    'staleness_offers_only', NULL, _threshold_days, NULL,
    COALESCE(v_candidates, ARRAY[]::uuid[]), ARRAY[]::uuid[], ARRAY[]::uuid[],
    v_total, 0, 0, 0, v_dry
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.qogita_sweep_stale_offers(integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qogita_sweep_stale_offers(integer, boolean) TO service_role;