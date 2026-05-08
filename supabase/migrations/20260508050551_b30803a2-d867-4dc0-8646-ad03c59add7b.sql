-- Ensure pg_trgm is available (already used elsewhere)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.admin_search_zero_results_with_suggestions(
  _days integer DEFAULT 30,
  _limit integer DEFAULT 100
)
RETURNS TABLE (
  normalized_query text,
  sample_query text,
  searches bigint,
  last_searched_at timestamptz,
  suggested_brands jsonb,
  suggested_categories jsonb,
  matching_products_count bigint,
  recommendation text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH zero AS (
    SELECT
      sl.normalized_query,
      (array_agg(sl.query ORDER BY sl.created_at DESC))[1] AS sample_query,
      COUNT(*)::bigint AS searches,
      MAX(sl.created_at) AS last_searched_at
    FROM public.search_logs sl
    WHERE sl.zero_results = true
      AND sl.created_at >= now() - (_days || ' days')::interval
      AND sl.normalized_query IS NOT NULL
      AND length(sl.normalized_query) >= 2
    GROUP BY sl.normalized_query
    ORDER BY COUNT(*) DESC, MAX(sl.created_at) DESC
    LIMIT _limit
  ),
  brand_sugg AS (
    SELECT z.normalized_query,
      jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'slug', b.slug,
        'is_active', b.is_active,
        'similarity', round(similarity(lower(b.name), z.normalized_query)::numeric, 3)
      ) ORDER BY similarity(lower(b.name), z.normalized_query) DESC) AS brands
    FROM zero z
    JOIN LATERAL (
      SELECT b.id, b.name, b.slug, b.is_active
      FROM public.brands b
      WHERE similarity(lower(b.name), z.normalized_query) > 0.35
      ORDER BY similarity(lower(b.name), z.normalized_query) DESC
      LIMIT 3
    ) b ON true
    GROUP BY z.normalized_query
  ),
  cat_sugg AS (
    SELECT z.normalized_query,
      jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'is_active', c.is_active,
        'similarity', round(similarity(lower(coalesce(c.name_fr, c.name)), z.normalized_query)::numeric, 3)
      ) ORDER BY similarity(lower(coalesce(c.name_fr, c.name)), z.normalized_query) DESC) AS cats
    FROM zero z
    JOIN LATERAL (
      SELECT c.id, c.name, c.slug, c.is_active, c.name_fr
      FROM public.categories c
      WHERE similarity(lower(coalesce(c.name_fr, c.name)), z.normalized_query) > 0.35
      ORDER BY similarity(lower(coalesce(c.name_fr, c.name)), z.normalized_query) DESC
      LIMIT 3
    ) c ON true
    GROUP BY z.normalized_query
  ),
  prod_match AS (
    SELECT z.normalized_query,
      (
        SELECT COUNT(*) FROM public.products p
        WHERE p.is_active = true
          AND (
            lower(p.name) ILIKE '%' || z.normalized_query || '%'
            OR similarity(lower(p.name), z.normalized_query) > 0.4
          )
        LIMIT 50
      ) AS cnt
    FROM zero z
  )
  SELECT
    z.normalized_query,
    z.sample_query,
    z.searches,
    z.last_searched_at,
    COALESCE(bs.brands, '[]'::jsonb) AS suggested_brands,
    COALESCE(cs.cats, '[]'::jsonb) AS suggested_categories,
    COALESCE(pm.cnt, 0)::bigint AS matching_products_count,
    CASE
      WHEN COALESCE(pm.cnt, 0) > 0
        THEN 'boost_seo'  -- produits existent mais pas trouvés → revoir mots-clés / synonymes
      WHEN bs.brands IS NOT NULL
        THEN 'activate_brand'  -- marque connue mais inactive ou sans produit
      WHEN cs.cats IS NOT NULL
        THEN 'enrich_category'  -- catégorie connue à étoffer
      ELSE 'add_to_catalog'  -- rien de proche : opportunité d'ajouter marque/produit
    END AS recommendation
  FROM zero z
  LEFT JOIN brand_sugg bs ON bs.normalized_query = z.normalized_query
  LEFT JOIN cat_sugg cs ON cs.normalized_query = z.normalized_query
  LEFT JOIN prod_match pm ON pm.normalized_query = z.normalized_query
  ORDER BY z.searches DESC, z.last_searched_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_search_zero_results_with_suggestions(integer, integer) TO authenticated;