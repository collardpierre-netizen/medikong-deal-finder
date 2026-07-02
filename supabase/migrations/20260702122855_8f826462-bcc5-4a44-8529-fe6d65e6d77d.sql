ALTER TABLE public.cms_hero_images
  ADD COLUMN IF NOT EXISTS image_fit TEXT NOT NULL DEFAULT 'cover'
  CHECK (image_fit IN ('cover', 'contain'));