-- Bulk-refresh denormalized best_bundle_size on products from current active offers.
-- Also auto-resolves "missing_moq" quality logs whose offer now has moq > 0.
-- Restricted to admins.

CREATE OR REPLACE FUNCTION public.refresh_best_bundle_sizes(_only_flagged boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_products_updated integer := 0;
  v_logs_resolved integer := 0;
  v_target_product_ids uuid[];
BEGIN
  IF v_user IS NULL OR NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  IF _only_flagged THEN
    SELECT ARRAY_AGG(DISTINCT product_id)
    INTO v_target_product_ids
    FROM public.offer_data_quality_logs
    WHERE issue_code IN ('missing_moq', 'bundle_moq_mismatch')
      AND resolved_at IS NULL
      AND product_id IS NOT NULL;
  END IF;

  WITH best AS (
    SELECT DISTINCT ON (o.product_id)
      o.product_id,
      o.moq AS bundle
    FROM public.offers o
    WHERE o.is_active = true
      AND (_only_flagged = false OR o.product_id = ANY(COALESCE(v_target_product_ids, ARRAY[]::uuid[])))
    ORDER BY o.product_id, o.price_excl_vat ASC NULLS LAST, o.moq ASC NULLS LAST
  )
  UPDATE public.products p
  SET best_bundle_size = b.bundle,
      updated_at = now()
  FROM best b
  WHERE p.id = b.product_id
    AND COALESCE(p.best_bundle_size, -1) IS DISTINCT FROM COALESCE(b.bundle, -1);

  GET DIAGNOSTICS v_products_updated = ROW_COUNT;

  -- Auto-resolve missing_moq logs where the linked offer now has a valid moq
  UPDATE public.offer_data_quality_logs l
  SET resolved_at = now()
  FROM public.offers o
  WHERE l.offer_id = o.id
    AND l.issue_code = 'missing_moq'
    AND l.resolved_at IS NULL
    AND COALESCE(o.moq, 0) > 0;

  GET DIAGNOSTICS v_logs_resolved = ROW_COUNT;

  RETURN jsonb_build_object(
    'products_updated', v_products_updated,
    'logs_resolved', v_logs_resolved,
    'scope', CASE WHEN _only_flagged THEN 'flagged' ELSE 'all_active' END,
    'ran_at', now()
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.refresh_best_bundle_sizes(boolean) TO authenticated;
