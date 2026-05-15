
DROP VIEW IF EXISTS public.admin_sourcing_items_by_brand_v;

CREATE VIEW public.admin_sourcing_items_by_brand_v
WITH (security_invoker = true) AS
SELECT
  COALESCE(b.id::TEXT, 'raw:' || lower(trim(s.raw_brand)), 'unknown') AS brand_key,
  b.id AS brand_id,
  COALESCE(b.name, NULLIF(trim(s.raw_brand), ''), '— Marque inconnue —') AS brand_label,
  COUNT(*)::INTEGER AS items_count,
  SUM(s.import_count)::INTEGER AS total_imports,
  SUM(s.user_count)::INTEGER AS total_users,
  SUM(s.total_quantity)::NUMERIC AS total_quantity,
  MAX(s.last_seen_at) AS last_seen_at,
  COUNT(*) FILTER (WHERE s.status = 'unmatched')::INTEGER AS unmatched_count,
  COUNT(*) FILTER (WHERE s.status = 'inactive_product')::INTEGER AS inactive_count,
  COUNT(*) FILTER (WHERE s.status = 'no_active_offer')::INTEGER AS no_offer_count,
  COALESCE((
    SELECT COUNT(*)::INTEGER
    FROM public.products p
    WHERE p.brand_id = b.id AND p.is_active = true
  ), 0) AS medikong_active_products_count
FROM public.buyer_comparator_sourcing_items s
LEFT JOIN public.brands b ON b.id = s.brand_id
WHERE s.admin_status IN ('todo','sourcing')
GROUP BY 1, 2, 3;
