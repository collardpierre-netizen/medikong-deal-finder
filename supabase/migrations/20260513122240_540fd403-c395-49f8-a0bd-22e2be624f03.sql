-- B: Multi-language support for announcement banner text
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS investment_banner_text_nl text,
  ADD COLUMN IF NOT EXISTS investment_banner_text_en text,
  ADD COLUMN IF NOT EXISTS investment_banner_text_de text;

-- A/C: Expose localized name columns in the price-delta showcase view
DROP VIEW IF EXISTS public.public_top_price_deltas;

CREATE VIEW public.public_top_price_deltas
WITH (security_invoker = true) AS
WITH agg AS (
  SELECT
    p.id            AS product_id,
    p.slug,
    p.name,
    p.name_fr,
    p.name_nl,
    p.name_en,
    p.name_de,
    b.name          AS brand_name,
    p.image_url,
    p.image_urls,
    MIN(o.price_excl_vat) AS min_price,
    MAX(o.price_excl_vat) AS max_price,
    COUNT(DISTINCT o.vendor_id) AS offer_count
  FROM public.products p
  JOIN public.offers o ON o.product_id = p.id
  LEFT JOIN public.brands b ON b.id = p.brand_id
  WHERE p.is_active = true
    AND o.is_active = true
    AND COALESCE(o.admin_hidden, false) = false
    AND o.price_excl_vat IS NOT NULL
    AND o.price_excl_vat > 0
  GROUP BY p.id, p.slug, p.name, p.name_fr, p.name_nl, p.name_en, p.name_de,
           b.name, p.image_url, p.image_urls
  HAVING COUNT(DISTINCT o.vendor_id) >= 3
)
SELECT
  product_id, slug, name, name_fr, name_nl, name_en, name_de,
  brand_name, image_url, image_urls,
  min_price, max_price, offer_count,
  ROUND(((max_price - min_price) / NULLIF(max_price, 0) * 100)::numeric, 1) AS delta_pct
FROM agg
WHERE max_price > 0
  AND ((max_price - min_price) / max_price) BETWEEN 0.15 AND 0.80
ORDER BY ((max_price - min_price) / max_price) DESC
LIMIT 30;

GRANT SELECT ON public.public_top_price_deltas TO anon, authenticated;