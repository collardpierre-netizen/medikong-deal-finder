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
    PERFORM cron.unschedule('qogita-stale-backfill-60d');
  END IF;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public.qogita_stale_backfill_batch(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qogita_stale_backfill_batch(integer, integer) TO service_role;