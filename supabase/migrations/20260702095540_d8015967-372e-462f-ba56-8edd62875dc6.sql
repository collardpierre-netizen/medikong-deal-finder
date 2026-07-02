
ALTER TABLE public.cms_hero_images
  ADD COLUMN IF NOT EXISTS focal_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS focal_y numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS zoom numeric NOT NULL DEFAULT 1;

ALTER TABLE public.cms_hero_images
  DROP CONSTRAINT IF EXISTS cms_hero_images_focal_range_chk;
ALTER TABLE public.cms_hero_images
  ADD CONSTRAINT cms_hero_images_focal_range_chk
  CHECK (focal_x BETWEEN 0 AND 100 AND focal_y BETWEEN 0 AND 100 AND zoom BETWEEN 1 AND 3);
