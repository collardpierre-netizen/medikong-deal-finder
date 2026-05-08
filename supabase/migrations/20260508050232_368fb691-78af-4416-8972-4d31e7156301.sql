CREATE OR REPLACE FUNCTION public.admin_search_top_queries(_days integer DEFAULT 7, _limit integer DEFAULT 50)
RETURNS TABLE (
  normalized_query text,
  sample_query text,
  searches bigint,
  clicks bigint,
  zero_result_searches bigint,
  click_rate numeric,
  zero_result_rate numeric,
  last_searched_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sl.normalized_query,
    (array_agg(sl.query ORDER BY sl.created_at DESC))[1] AS sample_query,
    count(*)::bigint AS searches,
    count(*) FILTER (WHERE sl.clicked_id IS NOT NULL)::bigint AS clicks,
    count(*) FILTER (WHERE sl.zero_results)::bigint AS zero_result_searches,
    ROUND(100.0 * count(*) FILTER (WHERE sl.clicked_id IS NOT NULL) / GREATEST(count(*),1), 1) AS click_rate,
    ROUND(100.0 * count(*) FILTER (WHERE sl.zero_results)            / GREATEST(count(*),1), 1) AS zero_result_rate,
    max(sl.created_at) AS last_searched_at
  FROM public.search_logs sl
  WHERE public.is_admin(auth.uid())
    AND sl.created_at >= now() - make_interval(days => _days)
    AND sl.normalized_query IS NOT NULL
    AND length(sl.normalized_query) > 0
  GROUP BY sl.normalized_query
  ORDER BY searches DESC
  LIMIT _limit
$$;

CREATE OR REPLACE FUNCTION public.admin_search_zero_results(_days integer DEFAULT 30, _limit integer DEFAULT 50)
RETURNS TABLE (
  normalized_query text,
  sample_query text,
  searches bigint,
  last_searched_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sl.normalized_query,
    (array_agg(sl.query ORDER BY sl.created_at DESC))[1] AS sample_query,
    count(*)::bigint AS searches,
    max(sl.created_at) AS last_searched_at
  FROM public.search_logs sl
  WHERE public.is_admin(auth.uid())
    AND sl.created_at >= now() - make_interval(days => _days)
    AND sl.zero_results
    AND sl.normalized_query IS NOT NULL
    AND length(sl.normalized_query) > 0
  GROUP BY sl.normalized_query
  ORDER BY searches DESC, last_searched_at DESC
  LIMIT _limit
$$;

CREATE OR REPLACE FUNCTION public.admin_search_kpis(_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_admin(auth.uid()) THEN '{"error":"forbidden"}'::jsonb
    ELSE (
      SELECT jsonb_build_object(
        'days', _days,
        'total_searches', count(*),
        'unique_queries', count(DISTINCT normalized_query),
        'clicks', count(*) FILTER (WHERE clicked_id IS NOT NULL),
        'zero_results', count(*) FILTER (WHERE zero_results),
        'click_rate', ROUND(100.0 * count(*) FILTER (WHERE clicked_id IS NOT NULL) / GREATEST(count(*),1), 1),
        'zero_result_rate', ROUND(100.0 * count(*) FILTER (WHERE zero_results)     / GREATEST(count(*),1), 1)
      )
      FROM public.search_logs
      WHERE created_at >= now() - make_interval(days => _days)
    )
  END
$$;

REVOKE ALL ON FUNCTION public.admin_search_top_queries(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_search_zero_results(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_search_kpis(integer)                  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_top_queries(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_zero_results(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_kpis(integer)                  TO authenticated;