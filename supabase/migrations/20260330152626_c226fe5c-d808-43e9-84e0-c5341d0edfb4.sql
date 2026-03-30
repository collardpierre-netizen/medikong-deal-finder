
-- Function to resolve brand_id on products where brand_name matches
CREATE OR REPLACE FUNCTION public.resolve_product_brands()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products p
  SET brand_id = b.id
  FROM brands b
  WHERE p.brand_name = b.name
    AND p.brand_id IS NULL;
END;
$$;

-- Function to resolve category_id on products where category_name matches
CREATE OR REPLACE FUNCTION public.resolve_product_categories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products p
  SET category_id = c.id
  FROM categories c
  WHERE p.category_name = c.name
    AND p.category_id IS NULL;
END;
$$;

-- Function to update brand product counts
CREATE OR REPLACE FUNCTION public.update_brand_product_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE brands b
  SET product_count = (
    SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id AND p.is_active = true
  );
END;
$$;
