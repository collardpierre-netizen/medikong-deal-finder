-- Add multilingual columns to categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name_nl text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name_de text;

-- Add multilingual columns to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name_nl text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name_de text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description_nl text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description_de text;