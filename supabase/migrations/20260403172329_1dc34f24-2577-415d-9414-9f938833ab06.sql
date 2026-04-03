-- Step 1: Identify duplicate product IDs to delete (keep best one per slug)
CREATE TEMP TABLE _dup_product_ids AS
SELECT id FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY slug 
    ORDER BY offer_count DESC NULLS LAST, created_at DESC
  ) AS rn
  FROM products
) ranked
WHERE rn > 1;

-- Step 2: Delete related data
DELETE FROM offer_price_tiers WHERE offer_id IN (SELECT id FROM offers WHERE product_id IN (SELECT id FROM _dup_product_ids));
DELETE FROM discount_tiers WHERE offer_id IN (SELECT id FROM offers WHERE product_id IN (SELECT id FROM _dup_product_ids));
DELETE FROM cart_items WHERE offer_id IN (SELECT id FROM offers WHERE product_id IN (SELECT id FROM _dup_product_ids));
DELETE FROM order_lines WHERE product_id IN (SELECT id FROM _dup_product_ids);
DELETE FROM offers WHERE product_id IN (SELECT id FROM _dup_product_ids);
DELETE FROM favorites WHERE product_id IN (SELECT id FROM _dup_product_ids);
DELETE FROM favorite_list_items WHERE product_id IN (SELECT id FROM _dup_product_ids);
DELETE FROM product_alerts WHERE product_id IN (SELECT id FROM _dup_product_ids);
DELETE FROM product_country_stats WHERE product_id IN (SELECT id FROM _dup_product_ids);
DELETE FROM product_market_codes WHERE product_id IN (SELECT id FROM _dup_product_ids);
DELETE FROM product_prices WHERE product_id IN (SELECT id FROM _dup_product_ids);
DELETE FROM price_history WHERE product_id IN (SELECT id FROM _dup_product_ids);
DELETE FROM market_prices WHERE product_id IN (SELECT id FROM _dup_product_ids);
DELETE FROM external_leads WHERE product_id IN (SELECT id FROM _dup_product_ids);
DELETE FROM external_offers WHERE product_id IN (SELECT id FROM _dup_product_ids);

-- Step 3: Delete duplicate products
DELETE FROM products WHERE id IN (SELECT id FROM _dup_product_ids);

-- Step 4: Cleanup
DROP TABLE _dup_product_ids;

-- Step 5: Create unique index
CREATE UNIQUE INDEX products_slug_unique ON public.products (slug);