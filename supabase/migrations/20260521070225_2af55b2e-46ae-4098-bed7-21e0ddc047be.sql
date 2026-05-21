UPDATE public.site_config
SET
  media_banner_title = 'Vendez mieux vos produits grâce aux supports de nos laboratoires et marques partenaires !',
  media_banner_subtitle = 'Diffusez simplement et rapidement tous vos supports médias grâce à notre partenaire Balooh.',
  media_banner_cta_label = COALESCE(NULLIF(media_banner_cta_label, ''), 'Découvrir Balooh'),
  media_banner_cta_url = COALESCE(NULLIF(media_banner_cta_url, ''), 'https://balooh.com/')
WHERE id = 1;

ALTER TABLE public.site_config
  ALTER COLUMN media_banner_title SET DEFAULT 'Vendez mieux vos produits grâce aux supports de nos laboratoires et marques partenaires !',
  ALTER COLUMN media_banner_subtitle SET DEFAULT 'Diffusez simplement et rapidement tous vos supports médias grâce à notre partenaire Balooh.';