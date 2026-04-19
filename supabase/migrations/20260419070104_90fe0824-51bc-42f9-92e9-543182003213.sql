
UPDATE public.products p
SET category_id = NULL
FROM public.categories c
WHERE p.category_id = c.id 
  AND c.is_active = false
  AND p.is_active = true;
