-- Vue publique des meilleurs écarts de prix multi-vendeurs (home demo)
CREATE OR REPLACE VIEW public.public_top_price_deltas
WITH (security_invoker = true) AS
WITH agg AS (
  SELECT
    o.product_id,
    MIN(o.price_excl_vat)::numeric AS min_price,
    MAX(o.price_excl_vat)::numeric AS max_price,
    COUNT(*)::int AS offer_count
  FROM public.offers o
  WHERE o.is_active = true
    AND COALESCE(o.admin_hidden, false) = false
    AND o.price_excl_vat IS NOT NULL
    AND o.price_excl_vat > 0
  GROUP BY o.product_id
  HAVING COUNT(*) >= 3
)
SELECT
  p.id AS product_id,
  p.slug,
  p.name,
  p.name_fr,
  p.brand_name,
  p.image_url,
  p.image_urls,
  a.min_price,
  a.max_price,
  a.offer_count,
  ROUND(100.0 * (a.max_price - a.min_price) / NULLIF(a.max_price, 0), 1) AS delta_pct
FROM agg a
JOIN public.products p ON p.id = a.product_id
WHERE p.is_active = true
  AND a.max_price > 0
  AND ROUND(100.0 * (a.max_price - a.min_price) / NULLIF(a.max_price, 0), 1) BETWEEN 15 AND 80
ORDER BY ROUND(100.0 * (a.max_price - a.min_price) / NULLIF(a.max_price, 0), 1) DESC
LIMIT 30;

GRANT SELECT ON public.public_top_price_deltas TO anon, authenticated;