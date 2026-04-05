CREATE OR REPLACE FUNCTION public.count_products_per_category()
 RETURNS TABLE(category_id uuid, product_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT p.category_id, COUNT(*) as product_count
  FROM products p
  WHERE p.is_active = true AND p.category_id IS NOT NULL
  GROUP BY p.category_id;
$$;

CREATE OR REPLACE FUNCTION public.update_brand_product_counts()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE brands b
  SET product_count = (
    SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id AND p.is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_manufacturer_product_counts()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE manufacturers m
  SET product_count = (
    SELECT COUNT(*) FROM products p WHERE p.manufacturer_id = m.id AND p.is_active = true
  );
END;
$$;