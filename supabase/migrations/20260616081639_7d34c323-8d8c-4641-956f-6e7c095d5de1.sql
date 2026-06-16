
-- Helper: which vendors are Qogita-backed (multi-vendor sellers + Balooh which proxies Qogita best-price)
CREATE OR REPLACE FUNCTION public.qogita_backed_vendor_ids()
RETURNS TABLE(vendor_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id
  FROM public.vendors v
  WHERE v.qogita_seller_alias IS NOT NULL
     OR v.name = 'Balooh'
$$;

REVOKE ALL ON FUNCTION public.qogita_backed_vendor_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.qogita_backed_vendor_ids() TO service_role;

-- =====================================================================
-- Core sweep: shared logic between run_id sweep (A) and staleness (B).
-- _candidate_offer_ids / _candidate_product_ids / _candidate_vendor_ids
-- are passed in by the caller. Guardrails are applied here.
-- Returns the log row id.
-- =====================================================================
CREATE OR REPLACE FUNCTION public._qogita_apply_sweep(
  _sweep_type text,                 -- 'run_id' | 'staleness'
  _sync_run_id uuid,                -- nullable
  _threshold_days integer,          -- nullable
  _country text,                    -- nullable
  _candidate_offers uuid[],
  _candidate_products uuid[],
  _candidate_vendors uuid[],
  _total_active_offers integer,
  _total_active_products integer,
  _total_active_vendors integer,
  _error_ratio numeric DEFAULT 0,
  _dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
  v_offers_count int := COALESCE(array_length(_candidate_offers, 1), 0);
  v_products_count int := COALESCE(array_length(_candidate_products, 1), 0);
  v_vendors_count int := COALESCE(array_length(_candidate_vendors, 1), 0);
  v_offers_pct numeric := CASE WHEN _total_active_offers > 0 THEN v_offers_count::numeric / _total_active_offers ELSE 0 END;
  v_products_pct numeric := CASE WHEN _total_active_products > 0 THEN v_products_count::numeric / _total_active_products ELSE 0 END;
  v_vendors_pct numeric := CASE WHEN _total_active_vendors > 0 THEN v_vendors_count::numeric / _total_active_vendors ELSE 0 END;
  v_status qogita_resync_status;
  v_deactivated_offers int := 0;
  v_deactivated_products int := 0;
  v_deactivated_vendors int := 0;
  v_spared jsonb := '{}'::jsonb;
  v_started timestamptz := now();
BEGIN
  -- Open log row
  INSERT INTO public.qogita_resync_logs(mode, status, triggered_by, country_code, sweep_type, sync_run_id, threshold_days, started_at, metadata)
  VALUES (
    'reconciliation_sweep',
    'running',
    'system',
    _country,
    _sweep_type,
    _sync_run_id,
    _threshold_days,
    v_started,
    jsonb_build_object(
      'candidates', jsonb_build_object(
        'offers', v_offers_count,
        'products', v_products_count,
        'vendors', v_vendors_count
      ),
      'totals_active', jsonb_build_object(
        'offers', _total_active_offers,
        'products', _total_active_products,
        'vendors', _total_active_vendors
      ),
      'error_ratio', _error_ratio,
      'dry_run', _dry_run
    )
  )
  RETURNING id INTO v_log_id;

  -- Guardrail 1: error ratio > 10%
  IF _error_ratio > 0.10 THEN
    v_spared := jsonb_build_object(
      'reason', 'error_ratio_above_10pct',
      'error_ratio', _error_ratio,
      'offers', v_offers_count,
      'products', v_products_count,
      'vendors', v_vendors_count
    );
    UPDATE public.qogita_resync_logs
      SET status = 'skipped_guardrail',
          completed_at = now(),
          duration_ms = (EXTRACT(EPOCH FROM (now() - v_started)) * 1000)::int,
          entities_spared = v_spared
      WHERE id = v_log_id;
    RETURN jsonb_build_object('log_id', v_log_id, 'status', 'skipped_guardrail', 'reason', 'error_ratio_above_10pct');
  END IF;

  -- Guardrail 2: any category would deactivate > 20%
  IF v_offers_pct > 0.20 OR v_products_pct > 0.20 OR v_vendors_pct > 0.20 THEN
    v_spared := jsonb_build_object(
      'reason', 'mass_deactivation_above_20pct',
      'offers_pct', v_offers_pct,
      'products_pct', v_products_pct,
      'vendors_pct', v_vendors_pct,
      'candidate_offer_ids', to_jsonb(_candidate_offers),
      'candidate_product_ids', to_jsonb(_candidate_products),
      'candidate_vendor_ids', to_jsonb(_candidate_vendors)
    );
    UPDATE public.qogita_resync_logs
      SET status = 'needs_review',
          completed_at = now(),
          duration_ms = (EXTRACT(EPOCH FROM (now() - v_started)) * 1000)::int,
          entities_spared = v_spared
      WHERE id = v_log_id;
    RETURN jsonb_build_object('log_id', v_log_id, 'status', 'needs_review', 'reason', 'mass_deactivation_above_20pct');
  END IF;

  IF _dry_run THEN
    UPDATE public.qogita_resync_logs
      SET status = 'success',
          completed_at = now(),
          duration_ms = (EXTRACT(EPOCH FROM (now() - v_started)) * 1000)::int,
          entities_deactivated = jsonb_build_object('offers', 0, 'products', 0, 'vendors', 0),
          entities_spared = jsonb_build_object('reason', 'dry_run',
            'would_deactivate', jsonb_build_object('offers', v_offers_count, 'products', v_products_count, 'vendors', v_vendors_count))
      WHERE id = v_log_id;
    RETURN jsonb_build_object('log_id', v_log_id, 'status', 'success', 'dry_run', true,
      'would_deactivate', jsonb_build_object('offers', v_offers_count, 'products', v_products_count, 'vendors', v_vendors_count));
  END IF;

  -- Apply deactivations
  IF v_offers_count > 0 THEN
    UPDATE public.offers
       SET is_active = false, stock_quantity = 0, updated_at = now()
     WHERE id = ANY(_candidate_offers) AND is_active = true;
    GET DIAGNOSTICS v_deactivated_offers = ROW_COUNT;
  END IF;

  IF v_products_count > 0 THEN
    UPDATE public.products
       SET is_active = false, updated_at = now()
     WHERE id = ANY(_candidate_products) AND is_active = true;
    GET DIAGNOSTICS v_deactivated_products = ROW_COUNT;
  END IF;

  IF v_vendors_count > 0 THEN
    UPDATE public.vendors
       SET is_active = false, updated_at = now()
     WHERE id = ANY(_candidate_vendors) AND is_active = true;
    GET DIAGNOSTICS v_deactivated_vendors = ROW_COUNT;
  END IF;

  UPDATE public.qogita_resync_logs
    SET status = 'success',
        completed_at = now(),
        duration_ms = (EXTRACT(EPOCH FROM (now() - v_started)) * 1000)::int,
        entities_deactivated = jsonb_build_object(
          'offers', v_deactivated_offers,
          'products', v_deactivated_products,
          'vendors', v_deactivated_vendors
        )
    WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'log_id', v_log_id,
    'status', 'success',
    'deactivated', jsonb_build_object(
      'offers', v_deactivated_offers,
      'products', v_deactivated_products,
      'vendors', v_deactivated_vendors
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public._qogita_apply_sweep(text, uuid, integer, text, uuid[], uuid[], uuid[], integer, integer, integer, numeric, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public._qogita_apply_sweep(text, uuid, integer, text, uuid[], uuid[], uuid[], integer, integer, integer, numeric, boolean) TO service_role;

-- =====================================================================
-- Sweep A: post-run reconciliation by sync_run_id
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qogita_sweep_run_id(
  _sync_run_id uuid,
  _country text DEFAULT NULL,
  _dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  IF _sync_run_id IS NULL THEN
    RAISE EXCEPTION '_sync_run_id is required';
  END IF;

  SELECT array_agg(vendor_id) INTO v_qogita_vendor_ids FROM public.qogita_backed_vendor_ids();
  IF v_qogita_vendor_ids IS NULL OR array_length(v_qogita_vendor_ids, 1) = 0 THEN
    RETURN jsonb_build_object('status', 'noop', 'reason', 'no_qogita_vendors');
  END IF;

  -- Candidate Qogita offers NOT touched by this run
  SELECT array_agg(o.id) INTO v_candidate_offers
  FROM public.offers o
  WHERE o.vendor_id = ANY(v_qogita_vendor_ids)
    AND o.is_active = true
    AND (o.last_sync_run_id IS DISTINCT FROM _sync_run_id);

  -- Candidate Qogita-only products NOT touched, with no other active offer
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

  -- Candidate Qogita vendors NOT touched and with no remaining active offer
  SELECT array_agg(v.id) INTO v_candidate_vendors
  FROM public.vendors v
  WHERE v.id = ANY(v_qogita_vendor_ids)
    AND v.is_active = true
    AND (v.last_sync_run_id IS DISTINCT FROM _sync_run_id)
    AND v.name <> 'Balooh'  -- never auto-deactivate Balooh (system vendor)
    AND NOT EXISTS (
      SELECT 1 FROM public.offers o3
       WHERE o3.vendor_id = v.id
         AND o3.is_active = true
         AND NOT (o3.last_sync_run_id IS DISTINCT FROM _sync_run_id)
    );

  -- Totals (active Qogita pool)
  SELECT count(*) INTO v_total_offers FROM public.offers WHERE vendor_id = ANY(v_qogita_vendor_ids) AND is_active = true;
  SELECT count(*) INTO v_total_products FROM public.products WHERE source = 'qogita' AND is_active = true;
  SELECT count(*) INTO v_total_vendors FROM public.vendors WHERE id = ANY(v_qogita_vendor_ids) AND is_active = true AND name <> 'Balooh';

  -- Error ratio from any qogita_resync_logs row matching this sync_run_id
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
    v_ratio, _dry_run
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qogita_sweep_run_id(uuid, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.qogita_sweep_run_id(uuid, text, boolean) TO service_role;

-- =====================================================================
-- Sweep B: daily staleness sweep
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qogita_sweep_staleness(
  _threshold_days integer DEFAULT 7,
  _country text DEFAULT NULL,
  _dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qogita_vendor_ids uuid[];
  v_candidate_offers uuid[];
  v_candidate_products uuid[];
  v_candidate_vendors uuid[];
  v_total_offers int;
  v_total_products int;
  v_total_vendors int;
  v_cutoff timestamptz;
BEGIN
  IF _threshold_days IS NULL OR _threshold_days < 1 THEN
    RAISE EXCEPTION '_threshold_days must be >= 1';
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
    AND v.name <> 'Balooh'
    AND NOT EXISTS (
      SELECT 1 FROM public.offers o3
       WHERE o3.vendor_id = v.id AND o3.is_active = true
         AND NOT (o3.synced_at IS NULL OR o3.synced_at < v_cutoff)
    );

  SELECT count(*) INTO v_total_offers FROM public.offers WHERE vendor_id = ANY(v_qogita_vendor_ids) AND is_active = true;
  SELECT count(*) INTO v_total_products FROM public.products WHERE source = 'qogita' AND is_active = true;
  SELECT count(*) INTO v_total_vendors FROM public.vendors WHERE id = ANY(v_qogita_vendor_ids) AND is_active = true AND name <> 'Balooh';

  RETURN public._qogita_apply_sweep(
    'staleness', NULL, _threshold_days, _country,
    COALESCE(v_candidate_offers, ARRAY[]::uuid[]),
    COALESCE(v_candidate_products, ARRAY[]::uuid[]),
    COALESCE(v_candidate_vendors, ARRAY[]::uuid[]),
    v_total_offers, v_total_products, v_total_vendors,
    0, _dry_run
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qogita_sweep_staleness(integer, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.qogita_sweep_staleness(integer, text, boolean) TO service_role;

-- =====================================================================
-- Sweep C: immediate stock-zero guard (called from sync functions)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qogita_deactivate_zero_stock_offers(_offer_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  IF _offer_ids IS NULL OR array_length(_offer_ids, 1) = 0 THEN RETURN 0; END IF;
  UPDATE public.offers
     SET is_active = false, stock_quantity = 0, updated_at = now()
   WHERE id = ANY(_offer_ids) AND is_active = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.qogita_deactivate_zero_stock_offers(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.qogita_deactivate_zero_stock_offers(uuid[]) TO service_role;

-- =====================================================================
-- Manual reactivation (admin only)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qogita_reactivate_entity(_kind text, _id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid(); v_count int := 0;
BEGIN
  IF NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  IF _kind = 'offer' THEN
    UPDATE public.offers SET is_active = true, updated_at = now() WHERE id = _id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSIF _kind = 'product' THEN
    UPDATE public.products SET is_active = true, updated_at = now() WHERE id = _id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSIF _kind = 'vendor' THEN
    UPDATE public.vendors SET is_active = true, updated_at = now() WHERE id = _id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'invalid kind: %', _kind;
  END IF;

  INSERT INTO public.audit_logs(user_id, action, resource_type, resource_id, metadata)
  VALUES (v_user, 'qogita_reactivate', _kind, _id::text, jsonb_build_object('reason', _reason));

  RETURN jsonb_build_object('updated', v_count, 'kind', _kind, 'id', _id);
END;
$$;

REVOKE ALL ON FUNCTION public.qogita_reactivate_entity(text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.qogita_reactivate_entity(text, uuid, text) TO authenticated;

-- =====================================================================
-- Admin read helper for /admin/sync
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_qogita_reconciliation_history(_limit integer DEFAULT 50)
RETURNS TABLE(
  id uuid,
  sweep_type text,
  sync_run_id uuid,
  status qogita_resync_status,
  country_code text,
  threshold_days integer,
  entities_deactivated jsonb,
  entities_spared jsonb,
  metadata jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, sweep_type, sync_run_id, status, country_code, threshold_days,
         entities_deactivated, entities_spared, metadata,
         started_at, completed_at, duration_ms
    FROM public.qogita_resync_logs
   WHERE sweep_type IS NOT NULL
     AND public.is_admin(auth.uid())
   ORDER BY started_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 500));
$$;

REVOKE ALL ON FUNCTION public.admin_qogita_reconciliation_history(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_qogita_reconciliation_history(integer) TO authenticated;
