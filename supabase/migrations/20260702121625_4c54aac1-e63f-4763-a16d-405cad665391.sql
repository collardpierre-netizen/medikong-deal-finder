
ALTER TABLE public.cms_hero_images
  ADD COLUMN IF NOT EXISTS show_title boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_subtitle boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS image_url_mobile text;
