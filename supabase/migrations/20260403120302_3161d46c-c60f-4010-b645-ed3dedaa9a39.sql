UPDATE brands b
SET product_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT p.brand_id, count(*) as cnt
  FROM products p
  WHERE p.is_active = true AND p.offer_count > 0
  GROUP BY p.brand_id
) sub
WHERE b.id = sub.brand_id;

UPDATE brands SET product_count = 0 WHERE id NOT IN (
  SELECT DISTINCT brand_id FROM products WHERE is_active = true AND offer_count > 0 AND brand_id IS NOT NULL
);