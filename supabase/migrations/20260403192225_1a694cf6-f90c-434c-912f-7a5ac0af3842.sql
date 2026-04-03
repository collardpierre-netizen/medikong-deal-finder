
CREATE OR REPLACE FUNCTION public.resolve_product_brands()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Exact match first
  UPDATE products p
  SET brand_id = b.id
  FROM brands b
  WHERE p.brand_name = b.name
    AND p.brand_id IS NULL;

  -- Case-insensitive fallback
  UPDATE products p
  SET brand_id = b.id
  FROM brands b
  WHERE LOWER(p.brand_name) = LOWER(b.name)
    AND p.brand_id IS NULL;
END;
$$;
