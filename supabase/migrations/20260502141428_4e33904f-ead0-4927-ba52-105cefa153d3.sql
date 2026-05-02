CREATE OR REPLACE FUNCTION public.update_product_aggregates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _product_id uuid;
BEGIN
  _product_id := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE products SET
    best_price_excl_vat = (SELECT MIN(price_excl_vat) FROM offers WHERE product_id = _product_id AND is_active = true),
    best_price_incl_vat = (SELECT MIN(price_incl_vat) FROM offers WHERE product_id = _product_id AND is_active = true),
    -- DISTINCT vendor_id : un même vendeur publie 1 offre commerciale, déclinée sur N pays.
    offer_count = (SELECT COUNT(DISTINCT vendor_id) FROM offers WHERE product_id = _product_id AND is_active = true),
    total_stock = (SELECT COALESCE(SUM(stock_quantity), 0) FROM offers WHERE product_id = _product_id AND is_active = true),
    min_delivery_days = (SELECT MIN(delivery_days) FROM offers WHERE product_id = _product_id AND is_active = true),
    is_in_stock = EXISTS(SELECT 1 FROM offers WHERE product_id = _product_id AND is_active = true AND stock_quantity > 0),
    best_bundle_size = (
      SELECT moq FROM offers
      WHERE product_id = _product_id AND is_active = true
      ORDER BY price_excl_vat ASC NULLS LAST, moq ASC NULLS LAST
      LIMIT 1
    ),
    updated_at = now()
  WHERE id = _product_id;
  RETURN NULL;
END;
$function$;

UPDATE products p SET
  offer_count = sub.cnt
FROM (
  SELECT product_id, COUNT(DISTINCT vendor_id) AS cnt
  FROM offers
  WHERE is_active = true
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id
  AND p.offer_count IS DISTINCT FROM sub.cnt;