
CREATE OR REPLACE FUNCTION public.public_search_brands_fuzzy(_q text, _limit int DEFAULT 8)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  product_count int,
  similarity real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH q AS (
    SELECT lower(public.f_unaccent(coalesce(_q, ''))) AS qn
  )
  SELECT
    b.id,
    b.name,
    b.slug,
    b.logo_url,
    coalesce(b.product_count, 0) AS product_count,
    GREATEST(
      extensions.similarity(lower(public.f_unaccent(b.name)), (SELECT qn FROM q)),
      extensions.similarity(lower(public.f_unaccent(coalesce(b.slug, ''))), (SELECT qn FROM q))
    ) AS similarity
  FROM public.brands b, q
  WHERE b.is_active = true
    AND length(q.qn) >= 2
    AND (
      lower(public.f_unaccent(b.name)) OPERATOR(extensions.%) q.qn
      OR lower(public.f_unaccent(coalesce(b.slug, ''))) OPERATOR(extensions.%) q.qn
      OR lower(public.f_unaccent(b.name)) LIKE '%' || q.qn || '%'
    )
  ORDER BY similarity DESC NULLS LAST, b.product_count DESC NULLS LAST
  LIMIT GREATEST(coalesce(_limit, 8), 1);
$$;

GRANT EXECUTE ON FUNCTION public.public_search_brands_fuzzy(text, int) TO anon, authenticated;
