
-- Fix VAT rate bug: 5,145 offers have vat_rate=0.21 instead of 21
UPDATE offers SET vat_rate = 21, price_incl_vat = ROUND(price_excl_vat * 1.21, 2) WHERE vat_rate = 0.21;

-- Now apply correct VAT 6% for products matched via CERP CNK codes
-- Create a temp table with CNK->VAT mapping, then update
UPDATE offers o
SET vat_rate = 6, price_incl_vat = ROUND(o.price_excl_vat * 1.06, 2)
FROM products p
WHERE o.product_id = p.id
  AND p.cnk_code IN ('1499698','3239282','1150364','1150372','1150380','1499706','1608281','1608299','1608307','2000307','2038381','2038399','2038407','2038415','2038423','2038431','2038449','2038456','2038464','2038472')
  AND o.vat_rate != 6;

-- For bulk update, use a smarter approach: update all offers where the product's CNK 
-- is in the CERP 6% list. We'll store the VAT info on categories instead.
-- For now, update the categories table with vat_rate based on product majority
