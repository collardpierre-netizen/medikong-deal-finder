CREATE OR REPLACE VIEW public.brand_kpis
WITH (security_invoker = true) AS
SELECT
  b.id AS brand_id,
  b.slug,
  COUNT(DISTINCT p.id) FILTER (WHERE p.is_active) AS active_product_count,
  COUNT(DISTINCT o.id) FILTER (WHERE o.is_active) AS active_offer_count,
  COUNT(DISTINCT o.vendor_id) FILTER (WHERE o.is_active) AS active_vendor_count,
  MIN(o.price_excl_vat) FILTER (WHERE o.is_active AND o.stock_quantity > 0) AS min_price_excl_vat,
  COUNT(DISTINCT v.country_code) FILTER (WHERE o.is_active AND v.country_code IS NOT NULL) AS ships_from_country_count,
  (AVG(o.delivery_days) FILTER (WHERE o.is_active AND o.delivery_days IS NOT NULL))::numeric(6,2) AS avg_delivery_days,
  MAX(o.updated_at) FILTER (WHERE o.is_active) AS last_offer_update_at
FROM public.brands b
LEFT JOIN public.products p ON p.brand_id = b.id
LEFT JOIN public.offers o ON o.product_id = p.id
LEFT JOIN public.vendors v ON v.id = o.vendor_id
GROUP BY b.id, b.slug;

COMMENT ON VIEW public.brand_kpis IS
  'KPIs agrégés par marque pour le Hero fiche marque. security_invoker=true : respecte les RLS de l''appelant.';