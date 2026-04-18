-- Match par EAN (priorité)
UPDATE market_prices mp
SET product_id = p.id, is_matched = true
FROM products p
WHERE mp.source_id = '6859c5f7-a5fe-4c75-b379-e6e1e6fcb759'
  AND mp.product_id IS NULL
  AND mp.ean IS NOT NULL AND mp.ean <> ''
  AND p.gtin = mp.ean;

-- Match par CNK (pour ceux qui n'ont pas matché par EAN)
UPDATE market_prices mp
SET product_id = p.id, is_matched = true
FROM products p
WHERE mp.source_id = '6859c5f7-a5fe-4c75-b379-e6e1e6fcb759'
  AND mp.product_id IS NULL
  AND mp.cnk IS NOT NULL AND mp.cnk <> ''
  AND p.cnk_code = mp.cnk;