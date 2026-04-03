
-- Deduplicate: reassign products from dupes to keeper
WITH ranked AS (
  SELECT id, slug, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY product_count DESC, id ASC) as rn
  FROM public.brands
),
dupes AS (
  SELECT r1.id as dupe_id, r2.id as keep_id
  FROM ranked r1
  JOIN ranked r2 ON r1.slug = r2.slug AND r2.rn = 1
  WHERE r1.rn > 1
)
UPDATE public.products p
SET brand_id = d.keep_id
FROM dupes d
WHERE p.brand_id = d.dupe_id;

-- Delete duplicates
WITH ranked AS (
  SELECT id, slug, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY product_count DESC, id ASC) as rn
  FROM public.brands
)
DELETE FROM public.brands WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Add unique constraint
ALTER TABLE public.brands ADD CONSTRAINT brands_slug_unique UNIQUE (slug);

-- Create missing brands
INSERT INTO public.brands (name, slug, is_active, product_count)
SELECT DISTINCT ON (p.brand_name)
  p.brand_name,
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(p.brand_name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')),
  true,
  0
FROM public.products p
WHERE p.brand_id IS NULL
  AND p.brand_name IS NOT NULL
  AND p.brand_name != ''
  AND NOT EXISTS (SELECT 1 FROM public.brands b WHERE b.name = p.brand_name)
ON CONFLICT (slug) DO NOTHING;

-- Resolve links and update counts
SELECT public.resolve_product_brands();
SELECT public.update_brand_product_counts();
