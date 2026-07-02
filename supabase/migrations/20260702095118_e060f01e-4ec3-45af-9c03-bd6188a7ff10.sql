
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.manufacturers
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb;
