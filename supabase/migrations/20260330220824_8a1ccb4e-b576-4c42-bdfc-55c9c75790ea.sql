-- Recalculate brand product_count from actual products
SELECT public.update_brand_product_counts();

-- Also update categories with product counts using a temp approach
-- Add parent_id grouping later, for now set icon based on category name patterns
UPDATE categories c SET icon = CASE
  WHEN c.name ILIKE '%baby%' OR c.name ILIKE '%child%' THEN 'Baby'
  WHEN c.name ILIKE '%hair%' OR c.name ILIKE '%shampoo%' OR c.name ILIKE '%conditioner%' THEN 'Scissors'
  WHEN c.name ILIKE '%skin%' OR c.name ILIKE '%face%' OR c.name ILIKE '%cream%' OR c.name ILIKE '%moistur%' OR c.name ILIKE '%serum%' THEN 'Droplets'
  WHEN c.name ILIKE '%sun%' OR c.name ILIKE '%tan%' THEN 'Sun'
  WHEN c.name ILIKE '%oral%' OR c.name ILIKE '%tooth%' OR c.name ILIKE '%dental%' OR c.name ILIKE '%mouth%' THEN 'Smile'
  WHEN c.name ILIKE '%nail%' THEN 'Paintbrush'
  WHEN c.name ILIKE '%eye%' OR c.name ILIKE '%mascara%' THEN 'Eye'
  WHEN c.name ILIKE '%body%' OR c.name ILIKE '%shower%' OR c.name ILIKE '%bath%' OR c.name ILIKE '%soap%' THEN 'Bath'
  WHEN c.name ILIKE '%fragrance%' OR c.name ILIKE '%perfume%' OR c.name ILIKE '%deodorant%' THEN 'Wind'
  WHEN c.name ILIKE '%makeup%' OR c.name ILIKE '%cosmetic%' OR c.name ILIKE '%lipstick%' OR c.name ILIKE '%foundation%' THEN 'Palette'
  WHEN c.name ILIKE '%vitamin%' OR c.name ILIKE '%supplement%' OR c.name ILIKE '%medicine%' OR c.name ILIKE '%pharma%' THEN 'Pill'
  WHEN c.name ILIKE '%clean%' OR c.name ILIKE '%hygien%' OR c.name ILIKE '%disinfect%' OR c.name ILIKE '%antisep%' THEN 'Shield'
  WHEN c.name ILIKE '%diet%' OR c.name ILIKE '%nutrition%' OR c.name ILIKE '%food%' THEN 'Apple'
  WHEN c.name ILIKE '%men%' OR c.name ILIKE '%shav%' OR c.name ILIKE '%beard%' THEN 'User'
  WHEN c.name ILIKE '%pet%' OR c.name ILIKE '%animal%' THEN 'PawPrint'
  WHEN c.name ILIKE '%home%' OR c.name ILIKE '%house%' OR c.name ILIKE '%laundry%' THEN 'Home'
  ELSE 'Package'
END
WHERE icon IS NULL;