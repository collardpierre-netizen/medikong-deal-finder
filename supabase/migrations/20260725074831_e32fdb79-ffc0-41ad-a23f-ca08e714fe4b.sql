
CREATE OR REPLACE FUNCTION public.admin_offer_margin_distribution()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH base AS (
    SELECT applied_margin_percentage::numeric AS m, price_stale
    FROM public.offers
    WHERE is_qogita_backed = true AND is_active = true
  ),
  fresh AS (
    SELECT m FROM base WHERE m IS NOT NULL AND (price_stale IS NOT TRUE)
  ),
  buckets AS (
    SELECT
      COUNT(*) FILTER (WHERE m < 10)                        AS b_lt10,
      COUNT(*) FILTER (WHERE m >= 10 AND m < 15)            AS b_10_15,
      COUNT(*) FILTER (WHERE m >= 15 AND m < 20)            AS b_15_20,
      COUNT(*) FILTER (WHERE m >= 20 AND m < 25)            AS b_20_25,
      COUNT(*) FILTER (WHERE m = 25)                        AS b_exact_25,
      COUNT(*) FILTER (WHERE m > 25 AND m <= 30)            AS b_25_30,
      COUNT(*) FILTER (WHERE m > 30 AND m <= 40)            AS b_30_40,
      COUNT(*) FILTER (WHERE m > 40)                        AS b_gt40
    FROM fresh
  ),
  stats AS (
    SELECT
      COUNT(*)                                       AS n,
      AVG(m)                                         AS avg_m,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY m) AS med_m,
      MIN(m)                                         AS min_m,
      MAX(m)                                         AS max_m,
      STDDEV_POP(m)                                  AS stddev_m,
      COUNT(*) FILTER (WHERE m = 25)                 AS n_exact_25
    FROM fresh
  )
  SELECT jsonb_build_object(
    'total_active_qogita', (SELECT COUNT(*) FROM base),
    'stale_pending',       (SELECT COUNT(*) FROM base WHERE price_stale IS TRUE),
    'fresh_with_margin',   s.n,
    'avg_margin',          ROUND(s.avg_m::numeric, 2),
    'median_margin',       ROUND(s.med_m::numeric, 2),
    'min_margin',          ROUND(s.min_m::numeric, 2),
    'max_margin',          ROUND(s.max_m::numeric, 2),
    'stddev_margin',       ROUND(COALESCE(s.stddev_m, 0)::numeric, 2),
    'exact_25_count',      s.n_exact_25,
    'exact_25_pct',        CASE WHEN s.n > 0 THEN ROUND((s.n_exact_25::numeric / s.n) * 100, 2) ELSE 0 END,
    'buckets', jsonb_build_object(
      'lt_10',   b.b_lt10,
      '10_15',   b.b_10_15,
      '15_20',   b.b_15_20,
      '20_25',   b.b_20_25,
      'eq_25',   b.b_exact_25,
      '25_30',   b.b_25_30,
      '30_40',   b.b_30_40,
      'gt_40',   b.b_gt40
    )
  ) INTO _result
  FROM stats s CROSS JOIN buckets b;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_offer_margin_distribution() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_offer_margin_distribution() TO authenticated, service_role;
