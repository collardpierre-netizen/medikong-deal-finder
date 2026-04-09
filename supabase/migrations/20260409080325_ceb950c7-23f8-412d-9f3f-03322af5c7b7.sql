
-- Step 1: Create a temp mapping of CNK -> VAT from CERP data stored in market_prices
-- We'll use a direct approach: update offers where products have CNK codes known to be 6% VAT
-- The CERP file has 16,085 products at 6% and 9,195 at 21%

-- First, let's add a vat_rate column to products to store the correct rate
ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_rate_be numeric DEFAULT 21;

-- Update products vat_rate from market_prices CERP source (tva_rate stored as decimal 0.06)
UPDATE products p
SET vat_rate_be = ROUND(mp.tva_rate * 100)
FROM market_prices mp
WHERE mp.cnk IS NOT NULL 
  AND p.cnk_code IS NOT NULL
  AND p.cnk_code = mp.cnk
  AND mp.tva_rate IS NOT NULL
  AND mp.tva_rate > 0
  AND mp.tva_rate < 1;

-- Now update all offers based on product's correct VAT rate
UPDATE offers o
SET vat_rate = p.vat_rate_be,
    price_incl_vat = ROUND(o.price_excl_vat * (1 + p.vat_rate_be / 100.0), 2)
FROM products p
WHERE o.product_id = p.id
  AND p.vat_rate_be IS NOT NULL
  AND p.vat_rate_be != o.vat_rate;
