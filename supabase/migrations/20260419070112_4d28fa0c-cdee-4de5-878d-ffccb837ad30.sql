
UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE p.category_id IS NULL
  AND p.is_active = true
  AND p.category_qid IS NOT NULL
  AND c.qogita_qid = p.category_qid
  AND c.is_active = true;
