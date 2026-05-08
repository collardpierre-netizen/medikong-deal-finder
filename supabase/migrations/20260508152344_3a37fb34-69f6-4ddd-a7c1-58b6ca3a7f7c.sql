CREATE OR REPLACE FUNCTION public.count_products_per_category()
RETURNS TABLE(category_id uuid, product_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT cat_id AS category_id, COUNT(DISTINCT product_id) AS product_count
  FROM (
    SELECT p.id AS product_id, p.category_id AS cat_id
    FROM products p
    WHERE p.is_active = true AND p.category_id IS NOT NULL
    UNION ALL
    SELECT p.id AS product_id, p.primary_category_id AS cat_id
    FROM products p
    WHERE p.is_active = true AND p.primary_category_id IS NOT NULL
  ) x
  GROUP BY cat_id;
$function$;