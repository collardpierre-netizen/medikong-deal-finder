CREATE OR REPLACE FUNCTION public.update_brand_product_counts()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE brands b
  SET product_count = (
    SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id AND p.is_active = true AND p.offer_count > 0
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
    SELECT COUNT(*) FROM products p WHERE p.manufacturer_id = m.id AND p.is_active = true AND p.offer_count > 0
  );
END;
$$;

SELECT public.update_brand_product_counts();
SELECT public.update_manufacturer_product_counts();