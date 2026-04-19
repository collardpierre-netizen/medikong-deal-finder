
UPDATE public.categories
SET is_active = false
WHERE name LIKE '%>%' AND is_active = true;
