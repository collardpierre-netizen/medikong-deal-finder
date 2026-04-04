-- Update products best_price_incl_vat from corrected offers
UPDATE products p SET
  best_price_incl_vat = sub.min_incl
FROM (
  SELECT product_id, MIN(price_incl_vat) as min_incl
  FROM offers WHERE is_active = true AND price_excl_vat > 0
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id AND p.best_price_excl_vat > 0;

-- Update product_country_stats
UPDATE product_country_stats pcs SET
  best_price_incl_vat = sub.min_incl
FROM (
  SELECT product_id, country_code, MIN(price_incl_vat) as min_incl
  FROM offers WHERE is_active = true AND price_excl_vat > 0
  GROUP BY product_id, country_code
) sub
WHERE pcs.product_id = sub.product_id AND pcs.country_code = sub.country_code;