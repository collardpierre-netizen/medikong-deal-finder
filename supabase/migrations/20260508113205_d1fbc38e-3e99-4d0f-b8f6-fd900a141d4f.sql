-- 1) Recreate products_with_country_stats_v with primary_category_id exposed
DROP VIEW IF EXISTS public.products_with_country_stats_v;

CREATE VIEW public.products_with_country_stats_v
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.slug,
  p.name,
  p.name_fr,
  p.name_nl,
  p.name_de,
  p.brand_name,
  p.brand_id,
  p.category_id,
  p.primary_category_id,
  p.category_name,
  p.manufacturer_id,
  p.gtin,
  p.cnk_code,
  p.image_url,
  p.image_urls,
  p.short_description,
  p.is_promotion,
  p.promotion_label,
  p.is_active,
  p.created_at,
  s.country_code,
  COALESCE(s.offer_count, 0) AS country_offer_count,
  s.best_price_excl_vat AS country_best_price_excl_vat,
  s.best_price_incl_vat AS country_best_price_incl_vat,
  COALESCE(s.total_stock, 0) AS country_total_stock,
  COALESCE(s.is_in_stock, false) AS country_is_in_stock,
  p.best_price_excl_vat AS global_best_price_excl_vat,
  p.best_price_incl_vat AS global_best_price_incl_vat,
  p.offer_count AS global_offer_count,
  p.total_stock AS global_total_stock,
  p.is_in_stock AS global_is_in_stock
FROM public.products p
LEFT JOIN public.product_country_stats s ON s.product_id = p.id;

GRANT SELECT ON public.products_with_country_stats_v TO anon, authenticated;

-- 2) category_descendants helper
CREATE OR REPLACE FUNCTION public.category_descendants(root_slug text)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT c.id FROM public.categories c WHERE c.slug = root_slug
    UNION
    SELECT c.id FROM public.categories c JOIN tree t ON c.parent_id = t.id
  )
  SELECT id FROM tree;
$$;

GRANT EXECUTE ON FUNCTION public.category_descendants(text) TO anon, authenticated;