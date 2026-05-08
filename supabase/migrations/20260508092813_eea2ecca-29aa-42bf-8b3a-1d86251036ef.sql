CREATE OR REPLACE FUNCTION public.admin_unmapped_categories(_limit int DEFAULT 200)
RETURNS TABLE (
  raw_label text,
  product_count bigint,
  has_alias boolean,
  mapped_to_slug text,
  mapped_to_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT COALESCE(NULLIF(TRIM(category_name), ''), NULLIF(TRIM(category), ''), '(vide)') AS raw_label,
           COUNT(*) AS product_count
    FROM public.products
    WHERE is_active = true
      AND primary_category_id IS NULL
      AND is_admin(auth.uid())
    GROUP BY 1
  )
  SELECT a.raw_label,
         a.product_count,
         (csa.category_id IS NOT NULL) AS has_alias,
         c.slug AS mapped_to_slug,
         c.name AS mapped_to_name
  FROM agg a
  LEFT JOIN public.category_source_aliases csa ON csa.source_path = a.raw_label
  LEFT JOIN public.categories c ON c.id = csa.category_id
  ORDER BY a.product_count DESC
  LIMIT GREATEST(_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.admin_unmapped_categories(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unmapped_categories(int) TO authenticated;