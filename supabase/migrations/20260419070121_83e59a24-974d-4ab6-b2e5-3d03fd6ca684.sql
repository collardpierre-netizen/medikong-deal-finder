
UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE p.category_id IS NULL
  AND p.is_active = true
  AND p.category_name IS NOT NULL
  AND LOWER(c.name) = LOWER(TRIM(SPLIT_PART(p.category_name, '>', -1)))
  AND c.is_active = true;
