-- Scope Qogita staleness reconciliation to products actually re-scanned.
-- Prior behavior: any offer with synced_at < cutoff was a candidate — this would
-- flag ~all Qogita offers because the storefront scraper only touches ~300
-- basket products/day, leaving 458k+ untouched. The 20% guardrail catches it
-- as "needs_review", but that also means the sweep never converges.
--
-- New rule: an offer is a candidate ONLY when:
--   - vendor is Qogita-backed AND offer.is_active
--   - offer.synced_at < cutoff (this offer wasn't refreshed)
--   - AND the parent product WAS re-scanned recently (product.synced_at >= cutoff)
-- Same rule for products/vendors: only touch entities whose sibling data
-- confirms they were actually re-scanned and dropped, never "silence = dead".

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

  -- Only consider offers whose parent product was actually re-scanned
  -- inside the freshness window. If the product hasn't been re-scanned,
  -- we have no evidence the offer disappeared — leave it alone.
  SELECT array_agg(o.id) INTO v_candidate_offers
  FROM public.offers o
  JOIN public.products p ON p.id = o.product_id
  WHERE o.vendor_id = ANY(v_qogita_vendor_ids)
    AND o.is_active = true
    AND (o.synced_at IS NULL OR o.synced_at < v_cutoff)
    AND p.synced_at IS NOT NULL
    AND p.synced_at >= v_cutoff;

  -- Products: only deactivate when the product itself was re-scanned recently
  -- AND no active non-stale Qogita offer remains. Same evidence-first rule.
  SELECT array_agg(p.id) INTO v_candidate_products
  FROM public.products p
  WHERE p.source = 'qogita'
    AND p.is_active = true
    AND p.synced_at IS NOT NULL
    AND p.synced_at >= v_cutoff
    AND NOT EXISTS (
      SELECT 1 FROM public.offers o2
       WHERE o2.product_id = p.id AND o2.is_active = true
         AND NOT (o2.vendor_id = ANY(v_qogita_vendor_ids)
                  AND (o2.synced_at IS NULL OR o2.synced_at < v_cutoff))
    );

  -- Vendors: only if all their remaining offers are stale AND at least one
  -- product they used to sell was re-scanned within the window (evidence
  -- the vendor was observable but no longer present).
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
    )
    AND EXISTS (
      SELECT 1 FROM public.offers o4
      JOIN public.products p4 ON p4.id = o4.product_id
       WHERE o4.vendor_id = v.id
         AND p4.synced_at IS NOT NULL
         AND p4.synced_at >= v_cutoff
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
  ) || jsonb_build_object(
    'forced_dry_run', v_forced,
    'reason', CASE WHEN v_forced THEN 'qogita_offers_source_unhealthy' ELSE NULL END,
    'scope_rule', 'product_rescanned_within_window'
  );
END;
$function$;