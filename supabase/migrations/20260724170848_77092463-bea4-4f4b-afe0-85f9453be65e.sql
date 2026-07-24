
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_offers_qogita_last_verified
  ON public.offers (is_qogita_backed, last_verified_at)
  WHERE is_qogita_backed = true;

INSERT INTO public.qogita_config (key, value, description)
VALUES
  ('offers_source_healthy', 'false',
   'Passe à true SEULEMENT après qu''un cycle complet du scraper storefront a stampé last_verified_at sur le périmètre. Tant que false : sweeps A/B/C forcés en dry_run, checkout bloque les offres price_stale.'),
  ('offers_frozen_since', '2026-07-10',
   'Date du dernier état correct des offres/prix Qogita avant retrait de l''API. Affiché dans le bandeau UI.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.qogita_offers_source_healthy()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value = 'true' FROM public.qogita_config WHERE key = 'offers_source_healthy'), false)
$$;

GRANT EXECUTE ON FUNCTION public.qogita_offers_source_healthy() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.qogita_sweep_staleness(_threshold_days integer DEFAULT 7, _country text DEFAULT NULL::text, _dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_qogita_vendor_ids uuid[];
  v_candidate_offers uuid[];
  v_candidate_products uuid[];
  v_candidate_vendors uuid[];
  v_total_offers int;
  v_total_products int;
  v_total_vendors int;
  v_cutoff timestamptz;
  v_effective_dry_run boolean := _dry_run;
  v_forced boolean := false;
BEGIN
  IF _threshold_days IS NULL OR _threshold_days < 1 THEN
    RAISE EXCEPTION '_threshold_days must be >= 1';
  END IF;
  IF NOT public.qogita_offers_source_healthy() THEN
    v_effective_dry_run := true;
    v_forced := true;
  END IF;
  v_cutoff := now() - (_threshold_days || ' days')::interval;

  SELECT array_agg(vendor_id) INTO v_qogita_vendor_ids FROM public.qogita_backed_vendor_ids();
  IF v_qogita_vendor_ids IS NULL OR array_length(v_qogita_vendor_ids, 1) = 0 THEN
    RETURN jsonb_build_object('status', 'noop', 'reason', 'no_qogita_vendors');
  END IF;

  SELECT array_agg(o.id) INTO v_candidate_offers
  FROM public.offers o
  WHERE o.vendor_id = ANY(v_qogita_vendor_ids)
    AND o.is_active = true
    AND (o.synced_at IS NULL OR o.synced_at < v_cutoff);

  SELECT array_agg(p.id) INTO v_candidate_products
  FROM public.products p
  WHERE p.source = 'qogita'
    AND p.is_active = true
    AND (p.synced_at IS NULL OR p.synced_at < v_cutoff)
    AND NOT EXISTS (
      SELECT 1 FROM public.offers o2
       WHERE o2.product_id = p.id AND o2.is_active = true
         AND NOT (o2.vendor_id = ANY(v_qogita_vendor_ids)
                  AND (o2.synced_at IS NULL OR o2.synced_at < v_cutoff))
    );

  SELECT array_agg(v.id) INTO v_candidate_vendors
  FROM public.vendors v
  WHERE v.id = ANY(v_qogita_vendor_ids)
    AND v.is_active = true
    AND v.name <> 'MediKong'
    AND NOT EXISTS (
      SELECT 1 FROM public.offers o3
       WHERE o3.vendor_id = v.id AND o3.is_active = true
         AND NOT (o3.vendor_id = ANY(v_qogita_vendor_ids)
                  AND (o3.synced_at IS NULL OR o3.synced_at < v_cutoff))
    );

  SELECT count(*) INTO v_total_offers FROM public.offers WHERE vendor_id = ANY(v_qogita_vendor_ids) AND is_active = true;
  SELECT count(*) INTO v_total_products FROM public.products WHERE source = 'qogita' AND is_active = true;
  SELECT count(*) INTO v_total_vendors FROM public.vendors WHERE id = ANY(v_qogita_vendor_ids) AND is_active = true AND name <> 'MediKong';

  RETURN public._qogita_apply_sweep(
    'staleness', NULL, _threshold_days, _country,
    COALESCE(v_candidate_offers, ARRAY[]::uuid[]),
    COALESCE(v_candidate_products, ARRAY[]::uuid[]),
    COALESCE(v_candidate_vendors, ARRAY[]::uuid[]),
    v_total_offers, v_total_products, v_total_vendors,
    0, v_effective_dry_run
  ) || jsonb_build_object('forced_dry_run', v_forced, 'reason', CASE WHEN v_forced THEN 'qogita_offers_source_unhealthy' ELSE NULL END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.qogita_sweep_run_id(_sync_run_id uuid, _country text DEFAULT NULL::text, _dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_qogita_vendor_ids uuid[];
  v_candidate_offers uuid[];
  v_candidate_products uuid[];
  v_candidate_vendors uuid[];
  v_total_offers int;
  v_total_products int;
  v_total_vendors int;
  v_errors int := 0;
  v_processed int := 0;
  v_ratio numeric := 0;
  v_effective_dry_run boolean := _dry_run;
  v_forced boolean := false;
BEGIN
  IF _sync_run_id IS NULL THEN
    RAISE EXCEPTION '_sync_run_id is required';
  END IF;
  IF NOT public.qogita_offers_source_healthy() THEN
    v_effective_dry_run := true;
    v_forced := true;
  END IF;

  SELECT array_agg(vendor_id) INTO v_qogita_vendor_ids FROM public.qogita_backed_vendor_ids();
  IF v_qogita_vendor_ids IS NULL OR array_length(v_qogita_vendor_ids, 1) = 0 THEN
    RETURN jsonb_build_object('status', 'noop', 'reason', 'no_qogita_vendors');
  END IF;

  SELECT array_agg(o.id) INTO v_candidate_offers
  FROM public.offers o
  WHERE o.vendor_id = ANY(v_qogita_vendor_ids)
    AND o.is_active = true
    AND (o.last_sync_run_id IS DISTINCT FROM _sync_run_id);

  SELECT array_agg(p.id) INTO v_candidate_products
  FROM public.products p
  WHERE p.source = 'qogita'
    AND p.is_active = true
    AND (p.last_sync_run_id IS DISTINCT FROM _sync_run_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.offers o2
       WHERE o2.product_id = p.id
         AND o2.is_active = true
         AND NOT (o2.vendor_id = ANY(v_qogita_vendor_ids) AND (o2.last_sync_run_id IS DISTINCT FROM _sync_run_id))
    );

  SELECT array_agg(v.id) INTO v_candidate_vendors
  FROM public.vendors v
  WHERE v.id = ANY(v_qogita_vendor_ids)
    AND v.is_active = true
    AND (v.last_sync_run_id IS DISTINCT FROM _sync_run_id)
    AND v.name <> 'MediKong'
    AND NOT EXISTS (
      SELECT 1 FROM public.offers o3
       WHERE o3.vendor_id = v.id
         AND o3.is_active = true
         AND NOT (o3.last_sync_run_id IS DISTINCT FROM _sync_run_id)
    );

  SELECT count(*) INTO v_total_offers FROM public.offers WHERE vendor_id = ANY(v_qogita_vendor_ids) AND is_active = true;
  SELECT count(*) INTO v_total_products FROM public.products WHERE source = 'qogita' AND is_active = true;
  SELECT count(*) INTO v_total_vendors FROM public.vendors WHERE id = ANY(v_qogita_vendor_ids) AND is_active = true AND name <> 'MediKong';

  SELECT COALESCE(sum(total_errors), 0), COALESCE(sum(offers_processed), 0)
    INTO v_errors, v_processed
    FROM public.qogita_resync_logs
   WHERE sync_run_id = _sync_run_id AND sweep_type IS NULL;
  IF v_processed > 0 THEN v_ratio := v_errors::numeric / v_processed; END IF;

  RETURN public._qogita_apply_sweep(
    'run_id', _sync_run_id, NULL, _country,
    COALESCE(v_candidate_offers, ARRAY[]::uuid[]),
    COALESCE(v_candidate_products, ARRAY[]::uuid[]),
    COALESCE(v_candidate_vendors, ARRAY[]::uuid[]),
    v_total_offers, v_total_products, v_total_vendors,
    v_ratio, v_effective_dry_run
  ) || jsonb_build_object('forced_dry_run', v_forced, 'reason', CASE WHEN v_forced THEN 'qogita_offers_source_unhealthy' ELSE NULL END);
END;
$function$;
