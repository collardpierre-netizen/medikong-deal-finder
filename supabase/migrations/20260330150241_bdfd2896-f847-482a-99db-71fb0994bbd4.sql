-- Insert missing brands from products
INSERT INTO brands (name, slug, is_active, synced_at)
SELECT DISTINCT
  p.brand_name,
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(
    TRANSLATE(p.brand_name, 'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ',
                            'aaaaaaeeeeiiiioooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYYNC'),
    '[^a-zA-Z0-9 -]', '', 'g'), '[ ]+', '-', 'g')),
  true,
  now()
FROM products p
WHERE p.brand_name IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM brands b WHERE b.name = p.brand_name)
ON CONFLICT (slug) DO NOTHING;

-- Now re-link brand_id
UPDATE products p
SET brand_id = b.id
FROM brands b
WHERE p.brand_name = b.name
  AND p.brand_id IS NULL
  AND p.brand_name IS NOT NULL;

-- Re-link category_id for the 1 remaining
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE p.category_name = c.name
  AND p.category_id IS NULL
  AND p.category_name IS NOT NULL;