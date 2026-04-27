-- 1. Add column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS best_bundle_size integer;

-- 2. Update aggregate trigger function to populate best_bundle_size
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
    offer_count = (SELECT COUNT(*) FROM offers WHERE product_id = _product_id AND is_active = true),
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

-- 3. Backfill existing rows
UPDATE public.products p
SET best_bundle_size = sub.moq
FROM (
  SELECT DISTINCT ON (product_id) product_id, moq
  FROM public.offers
  WHERE is_active = true
  ORDER BY product_id, price_excl_vat ASC NULLS LAST, moq ASC NULLS LAST
) sub
WHERE p.id = sub.product_id;