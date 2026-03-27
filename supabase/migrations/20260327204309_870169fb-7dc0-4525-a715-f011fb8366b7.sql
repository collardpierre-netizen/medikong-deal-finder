
-- Create a GIN index for full-text search on products
CREATE INDEX IF NOT EXISTS idx_products_search ON public.products USING gin(
  to_tsvector('simple', coalesce(product_name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(gtin, '') || ' ' || coalesce(mpn, '') || ' ' || coalesce(category_l1, '') || ' ' || coalesce(category_l2, '') || ' ' || coalesce(category_l3, ''))
);

-- Create search function
CREATE OR REPLACE FUNCTION public.search_products(search_query text)
RETURNS SETOF public.products
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
  SELECT *
  FROM public.products
  WHERE status = 'active'
    AND (
      product_name ILIKE '%' || search_query || '%'
      OR brand ILIKE '%' || search_query || '%'
      OR gtin ILIKE '%' || search_query || '%'
      OR mpn ILIKE '%' || search_query || '%'
      OR category_l1 ILIKE '%' || search_query || '%'
      OR category_l2 ILIKE '%' || search_query || '%'
      OR category_l3 ILIKE '%' || search_query || '%'
    )
  ORDER BY
    CASE
      WHEN gtin = search_query THEN 0
      WHEN mpn = search_query THEN 1
      WHEN product_name ILIKE search_query THEN 2
      WHEN brand ILIKE search_query THEN 3
      ELSE 4
    END,
    product_name ASC;
$$;
