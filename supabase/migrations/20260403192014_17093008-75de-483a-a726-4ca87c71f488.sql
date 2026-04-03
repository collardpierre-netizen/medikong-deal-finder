
-- Create missing brand "Hydratis" and link orphan products
INSERT INTO public.brands (name, slug, is_active, product_count)
VALUES ('Hydratis', 'hydratis', true, 9)
ON CONFLICT DO NOTHING;

-- Link products to their brand
UPDATE public.products
SET brand_id = (SELECT id FROM public.brands WHERE slug = 'hydratis' LIMIT 1)
WHERE brand_name = 'Hydratis' AND brand_id IS NULL;
