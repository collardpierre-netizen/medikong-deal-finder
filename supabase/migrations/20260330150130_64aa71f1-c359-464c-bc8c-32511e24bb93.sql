-- Link brand_id on all products where brand_name matches a brand
UPDATE products p
SET brand_id = b.id
FROM brands b
WHERE p.brand_name = b.name
  AND p.brand_id IS NULL
  AND p.brand_name IS NOT NULL;

-- Link category_id on all products where category_name matches a category
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE p.category_name = c.name
  AND p.category_id IS NULL
  AND p.category_name IS NOT NULL;