
-- Wrapper IMMUTABLE pour unaccent (nécessaire pour indexer)
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

-- Index trigram sur nom normalisé + slug
CREATE INDEX IF NOT EXISTS idx_brands_name_trgm
  ON public.brands USING gin (lower(public.f_unaccent(name)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_brands_slug_trgm
  ON public.brands USING gin (slug gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.admin_search_brands_fuzzy(
  _q text,
  _limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  product_count int,
  is_active boolean,
  is_featured boolean,
  country_of_origin text,
  website_url text,
  description text,
  similarity real,
  match_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qn text := lower(public.f_unaccent(coalesce(_q, '')));
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF qn = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.id, b.name, b.slug, b.logo_url, b.product_count, b.is_active, b.is_featured,
    b.country_of_origin, b.website_url, b.description,
    GREATEST(
      similarity(lower(public.f_unaccent(b.name)), qn),
      similarity(b.slug, qn)
    )::real AS sim,
    CASE
      WHEN lower(public.f_unaccent(b.name)) = qn OR b.slug = qn THEN 'exact'
      WHEN lower(public.f_unaccent(b.name)) LIKE '%' || qn || '%' OR b.slug LIKE '%' || qn || '%' THEN 'substring'
      ELSE 'fuzzy'
    END AS match_type
  FROM public.brands b
  WHERE
    lower(public.f_unaccent(b.name)) % qn
    OR b.slug % qn
    OR lower(public.f_unaccent(b.name)) LIKE '%' || qn || '%'
    OR b.slug LIKE '%' || qn || '%'
  ORDER BY
    CASE
      WHEN lower(public.f_unaccent(b.name)) = qn OR b.slug = qn THEN 0
      WHEN lower(public.f_unaccent(b.name)) LIKE '%' || qn || '%' OR b.slug LIKE '%' || qn || '%' THEN 1
      ELSE 2
    END,
    GREATEST(
      similarity(lower(public.f_unaccent(b.name)), qn),
      similarity(b.slug, qn)
    ) DESC,
    b.product_count DESC NULLS LAST
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_search_brands_fuzzy(text, int) TO authenticated;
