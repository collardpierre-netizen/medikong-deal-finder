
CREATE OR REPLACE FUNCTION public.admin_catalog_wide_progress(_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  WITH runs AS (
    SELECT
      id,
      status,
      started_at,
      completed_at,
      duration_ms,
      products_targeted,
      products_processed,
      offers_created,
      offers_updated,
      total_errors,
      COALESCE(metadata->>'sub_mode', metadata->>'mode') AS sub_mode,
      (metadata->>'throttled')::boolean AS throttled,
      COALESCE((metadata->>'throttle_hits')::int, 0) AS throttle_hits,
      COALESCE((metadata->>'stale_recalculated')::int, 0) AS stale_recalc,
      COALESCE((metadata->>'tiers_written')::int, 0) AS tiers_written,
      COALESCE((metadata->>'vendors_created')::int, 0) AS vendors_created
    FROM public.qogita_resync_logs
    WHERE mode = 'storefront'
      AND started_at > now() - make_interval(hours => _hours)
  ),
  wide AS (SELECT * FROM runs WHERE sub_mode = 'catalog_wide'),
  basket AS (SELECT * FROM runs WHERE sub_mode IN ('catalog', 'basket') OR sub_mode IS NULL),
  hourly AS (
    SELECT
      date_trunc('hour', started_at) AS bucket,
      COUNT(*) FILTER (WHERE sub_mode = 'catalog_wide') AS runs_wide,
      SUM(products_processed) FILTER (WHERE sub_mode = 'catalog_wide') AS products_wide,
      SUM(offers_created + offers_updated) FILTER (WHERE sub_mode = 'catalog_wide') AS offers_wide,
      SUM(products_processed) FILTER (WHERE sub_mode <> 'catalog_wide' OR sub_mode IS NULL) AS products_basket,
      COUNT(*) FILTER (WHERE throttled) AS throttled_runs,
      SUM(total_errors) AS errors
    FROM runs
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'window_hours', _hours,
    'now', now(),
    'catalog_wide', (
      SELECT jsonb_build_object(
        'runs', COUNT(*),
        'runs_success', COUNT(*) FILTER (WHERE status = 'success'),
        'runs_failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'runs_throttled', COUNT(*) FILTER (WHERE throttled),
        'throttle_hits_total', COALESCE(SUM(throttle_hits), 0),
        'products_processed', COALESCE(SUM(products_processed), 0),
        'products_targeted', COALESCE(SUM(products_targeted), 0),
        'offers_created', COALESCE(SUM(offers_created), 0),
        'offers_updated', COALESCE(SUM(offers_updated), 0),
        'tiers_written', COALESCE(SUM(tiers_written), 0),
        'vendors_created', COALESCE(SUM(vendors_created), 0),
        'stale_recalculated', COALESCE(SUM(stale_recalc), 0),
        'errors', COALESCE(SUM(total_errors), 0),
        'avg_duration_ms', COALESCE(AVG(duration_ms)::bigint, 0),
        'last_run_at', MAX(started_at),
        'last_run_status', (SELECT status FROM wide ORDER BY started_at DESC LIMIT 1)
      ) FROM wide
    ),
    'basket', (
      SELECT jsonb_build_object(
        'runs', COUNT(*),
        'products_processed', COALESCE(SUM(products_processed), 0),
        'offers_created', COALESCE(SUM(offers_created), 0),
        'last_run_at', MAX(started_at)
      ) FROM basket
    ),
    'hourly', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'bucket', bucket,
      'runs_wide', runs_wide,
      'products_wide', COALESCE(products_wide, 0),
      'offers_wide', COALESCE(offers_wide, 0),
      'products_basket', COALESCE(products_basket, 0),
      'throttled_runs', throttled_runs,
      'errors', COALESCE(errors, 0)
    ) ORDER BY bucket) FROM hourly), '[]'::jsonb),
    'recent_runs', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.started_at DESC)
      FROM (
        SELECT id, sub_mode, status, started_at, completed_at, duration_ms,
               products_targeted, products_processed, offers_created, offers_updated,
               throttled, throttle_hits, total_errors, stale_recalc
        FROM runs
        ORDER BY started_at DESC
        LIMIT 30
      ) r
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_catalog_wide_coverage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_offers bigint;
  fresh_12h bigint;
  fresh_48h bigint;
  never_verified bigint;
  stale_offers bigint;
  distinct_products bigint;
  last_24h_products bigint;
  eta_days numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE last_verified_at > now() - interval '12 hours'),
    COUNT(*) FILTER (WHERE last_verified_at > now() - interval '48 hours'),
    COUNT(*) FILTER (WHERE last_verified_at IS NULL),
    COUNT(*) FILTER (WHERE price_stale IS TRUE),
    COUNT(DISTINCT product_id)
  INTO total_offers, fresh_12h, fresh_48h, never_verified, stale_offers, distinct_products
  FROM public.offers
  WHERE is_qogita_backed = true AND is_active = true;

  SELECT COALESCE(SUM(products_processed), 0)
  INTO last_24h_products
  FROM public.qogita_resync_logs
  WHERE mode = 'storefront'
    AND COALESCE(metadata->>'sub_mode', metadata->>'mode') = 'catalog_wide'
    AND started_at > now() - interval '24 hours';

  IF last_24h_products > 0 AND distinct_products > 0 THEN
    eta_days := ROUND((distinct_products::numeric / last_24h_products::numeric), 1);
  ELSE
    eta_days := NULL;
  END IF;

  RETURN jsonb_build_object(
    'total_qogita_offers', total_offers,
    'distinct_qogita_products', distinct_products,
    'fresh_12h', fresh_12h,
    'fresh_48h', fresh_48h,
    'never_verified', never_verified,
    'price_stale', stale_offers,
    'pct_fresh_48h', CASE WHEN total_offers > 0 THEN ROUND(100.0 * fresh_48h / total_offers, 2) ELSE 0 END,
    'pct_fresh_12h', CASE WHEN total_offers > 0 THEN ROUND(100.0 * fresh_12h / total_offers, 2) ELSE 0 END,
    'pct_never', CASE WHEN total_offers > 0 THEN ROUND(100.0 * never_verified / total_offers, 2) ELSE 0 END,
    'products_last_24h', last_24h_products,
    'eta_days_full_cycle', eta_days,
    'computed_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_catalog_wide_progress(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_catalog_wide_coverage() TO authenticated;
