CREATE OR REPLACE FUNCTION public.count_products_per_category_recursive()
RETURNS TABLE(category_id uuid, product_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE
  direct AS (
    SELECT p.category_id, COUNT(*)::bigint AS cnt
    FROM products p
    WHERE p.is_active = true AND p.category_id IS NOT NULL
    GROUP BY p.category_id
  ),
  -- For every category, find all descendants (incl. itself)
  tree AS (
    SELECT c.id AS root_id, c.id AS node_id
    FROM categories c
    WHERE c.is_active = true
    UNION ALL
    SELECT t.root_id, ch.id
    FROM tree t
    JOIN categories ch ON ch.parent_id = t.node_id
    WHERE ch.is_active = true
  )
  SELECT t.root_id AS category_id,
         COALESCE(SUM(d.cnt), 0)::bigint AS product_count
  FROM tree t
  LEFT JOIN direct d ON d.category_id = t.node_id
  GROUP BY t.root_id;
$$;