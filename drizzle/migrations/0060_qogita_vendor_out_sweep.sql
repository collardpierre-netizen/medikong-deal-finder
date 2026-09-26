ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS qogita_auto_deactivated_at timestamptz;
COMMENT ON COLUMN public.vendors.qogita_auto_deactivated_at IS 'Set when a Qogita seller was deactivated automatically because it had no active offer; cleared on automatic reactivation.';

CREATE OR REPLACE FUNCTION public.qogita_sweep_empty_vendors(_enforce_guardrail boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_total int; v_cand int; v_n int;
BEGIN
  SELECT count(*) INTO v_total FROM public.vendors WHERE qogita_seller_alias IS NOT NULL AND name <> 'MediKong' AND is_active;
  SELECT count(*) INTO v_cand FROM public.vendors v
   WHERE v.qogita_seller_alias IS NOT NULL AND v.name <> 'MediKong' AND v.is_active
     AND NOT EXISTS (SELECT 1 FROM public.offers o WHERE o.vendor_id = v.id AND o.is_active);
  IF _enforce_guardrail AND v_total > 0 AND v_cand::numeric / v_total > 0.20 THEN
    RETURN jsonb_build_object('status','needs_review','candidates',v_cand,'total',v_total);
  END IF;
  UPDATE public.vendors v SET is_active = false, qogita_auto_deactivated_at = now(), updated_at = now()
   WHERE v.qogita_seller_alias IS NOT NULL AND v.name <> 'MediKong' AND v.is_active
     AND NOT EXISTS (SELECT 1 FROM public.offers o WHERE o.vendor_id = v.id AND o.is_active);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('status','success','deactivated',v_n,'total',v_total);
END;
$function$;
REVOKE ALL ON FUNCTION public.qogita_sweep_empty_vendors(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qogita_sweep_empty_vendors(boolean) TO service_role;

CREATE OR REPLACE FUNCTION public._qogita_reactivate_vendor_on_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.vendors SET is_active = true, qogita_auto_deactivated_at = NULL, updated_at = now()
   WHERE id = NEW.vendor_id AND is_active = false AND qogita_auto_deactivated_at IS NOT NULL;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_qogita_reactivate_vendor ON public.offers;
CREATE TRIGGER trg_qogita_reactivate_vendor
AFTER INSERT OR UPDATE OF is_active ON public.offers
FOR EACH ROW WHEN (NEW.is_active = true)
EXECUTE FUNCTION public._qogita_reactivate_vendor_on_offer();

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
    v_res := v_res || jsonb_build_object('vendors', public.qogita_sweep_empty_vendors(true));
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
    PERFORM public.qogita_sweep_empty_vendors(false);
    PERFORM cron.unschedule('qogita-stale-backfill-60d');
  END IF;
  RETURN v_n;
END;
$function$;