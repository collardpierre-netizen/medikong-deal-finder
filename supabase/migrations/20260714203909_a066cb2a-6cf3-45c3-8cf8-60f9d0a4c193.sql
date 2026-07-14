
-- Répartition par type de profession
CREATE OR REPLACE FUNCTION public.admin_search_by_profession(_days int DEFAULT 7)
RETURNS TABLE(
  profession_type_id uuid,
  profession_name text,
  searches bigint,
  clicks bigint,
  zero_results bigint,
  click_rate numeric,
  zero_result_rate numeric,
  share numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_from timestamptz := now() - (_days || ' days')::interval;
  v_total bigint;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.search_logs WHERE created_at >= v_from;

  RETURN QUERY
  SELECT
    sl.profession_type_id,
    COALESCE(pt.name, 'Non renseigné')::text,
    COUNT(*)::bigint AS searches,
    COUNT(*) FILTER (WHERE sl.clicked_result_id IS NOT NULL)::bigint AS clicks,
    COUNT(*) FILTER (WHERE COALESCE(sl.results_count, 0) = 0)::bigint AS zero_results,
    CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE sl.clicked_result_id IS NOT NULL)::numeric * 100 / COUNT(*), 1) ELSE 0 END,
    CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE COALESCE(sl.results_count, 0) = 0)::numeric * 100 / COUNT(*), 1) ELSE 0 END,
    CASE WHEN v_total > 0 THEN ROUND(COUNT(*)::numeric * 100 / v_total, 1) ELSE 0 END
  FROM public.search_logs sl
  LEFT JOIN public.profession_types pt ON pt.id = sl.profession_type_id
  WHERE sl.created_at >= v_from
  GROUP BY sl.profession_type_id, pt.name
  ORDER BY searches DESC
  LIMIT 50;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_search_by_profession(int) TO authenticated;

-- Répartition par pays
CREATE OR REPLACE FUNCTION public.admin_search_by_country(_days int DEFAULT 7)
RETURNS TABLE(
  country_code text,
  searches bigint,
  clicks bigint,
  zero_results bigint,
  click_rate numeric,
  zero_result_rate numeric,
  share numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_from timestamptz := now() - (_days || ' days')::interval;
  v_total bigint;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.search_logs WHERE created_at >= v_from;

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(sl.profile_country, ''), 'UNK')::text,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE sl.clicked_result_id IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE COALESCE(sl.results_count, 0) = 0)::bigint,
    CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE sl.clicked_result_id IS NOT NULL)::numeric * 100 / COUNT(*), 1) ELSE 0 END,
    CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE COALESCE(sl.results_count, 0) = 0)::numeric * 100 / COUNT(*), 1) ELSE 0 END,
    CASE WHEN v_total > 0 THEN ROUND(COUNT(*)::numeric * 100 / v_total, 1) ELSE 0 END
  FROM public.search_logs sl
  WHERE sl.created_at >= v_from
  GROUP BY COALESCE(NULLIF(sl.profile_country, ''), 'UNK')
  ORDER BY 2 DESC
  LIMIT 50;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_search_by_country(int) TO authenticated;

-- Top requêtes par profession
CREATE OR REPLACE FUNCTION public.admin_search_top_by_profession(_days int DEFAULT 7, _per_group int DEFAULT 10)
RETURNS TABLE(
  profession_type_id uuid,
  profession_name text,
  normalized_query text,
  sample_query text,
  searches bigint,
  click_rate numeric,
  zero_result_rate numeric,
  rank int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_from timestamptz := now() - (_days || ' days')::interval;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT
      sl.profession_type_id,
      COALESCE(pt.name, 'Non renseigné')::text AS pname,
      LOWER(TRIM(sl.query)) AS nq,
      (ARRAY_AGG(sl.query ORDER BY sl.created_at DESC))[1] AS sq,
      COUNT(*)::bigint AS n,
      COUNT(*) FILTER (WHERE sl.clicked_result_id IS NOT NULL)::bigint AS clk,
      COUNT(*) FILTER (WHERE COALESCE(sl.results_count, 0) = 0)::bigint AS zr
    FROM public.search_logs sl
    LEFT JOIN public.profession_types pt ON pt.id = sl.profession_type_id
    WHERE sl.created_at >= v_from AND sl.query IS NOT NULL AND LENGTH(TRIM(sl.query)) > 0
    GROUP BY sl.profession_type_id, pt.name, LOWER(TRIM(sl.query))
  ),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY profession_type_id ORDER BY n DESC) AS rnk
    FROM agg
  )
  SELECT
    r.profession_type_id,
    r.pname,
    r.nq,
    r.sq,
    r.n,
    CASE WHEN r.n > 0 THEN ROUND(r.clk::numeric * 100 / r.n, 1) ELSE 0 END,
    CASE WHEN r.n > 0 THEN ROUND(r.zr::numeric * 100 / r.n, 1) ELSE 0 END,
    r.rnk::int
  FROM ranked r
  WHERE r.rnk <= _per_group
  ORDER BY r.pname, r.rnk;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_search_top_by_profession(int, int) TO authenticated;

-- Top requêtes par pays
CREATE OR REPLACE FUNCTION public.admin_search_top_by_country(_days int DEFAULT 7, _per_group int DEFAULT 10)
RETURNS TABLE(
  country_code text,
  normalized_query text,
  sample_query text,
  searches bigint,
  click_rate numeric,
  zero_result_rate numeric,
  rank int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_from timestamptz := now() - (_days || ' days')::interval;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT
      COALESCE(NULLIF(sl.profile_country, ''), 'UNK')::text AS cc,
      LOWER(TRIM(sl.query)) AS nq,
      (ARRAY_AGG(sl.query ORDER BY sl.created_at DESC))[1] AS sq,
      COUNT(*)::bigint AS n,
      COUNT(*) FILTER (WHERE sl.clicked_result_id IS NOT NULL)::bigint AS clk,
      COUNT(*) FILTER (WHERE COALESCE(sl.results_count, 0) = 0)::bigint AS zr
    FROM public.search_logs sl
    WHERE sl.created_at >= v_from AND sl.query IS NOT NULL AND LENGTH(TRIM(sl.query)) > 0
    GROUP BY COALESCE(NULLIF(sl.profile_country, ''), 'UNK'), LOWER(TRIM(sl.query))
  ),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY cc ORDER BY n DESC) AS rnk
    FROM agg
  )
  SELECT
    r.cc,
    r.nq,
    r.sq,
    r.n,
    CASE WHEN r.n > 0 THEN ROUND(r.clk::numeric * 100 / r.n, 1) ELSE 0 END,
    CASE WHEN r.n > 0 THEN ROUND(r.zr::numeric * 100 / r.n, 1) ELSE 0 END,
    r.rnk::int
  FROM ranked r
  WHERE r.rnk <= _per_group
  ORDER BY r.cc, r.rnk;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_search_top_by_country(int, int) TO authenticated;
