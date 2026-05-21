ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS media_banner_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS media_banner_title text DEFAULT 'Vous cherchez une marque ou un produit absent du catalogue ?',
  ADD COLUMN IF NOT EXISTS media_banner_subtitle text DEFAULT 'Notre partenaire Balooh source pour vous toutes les marques pharma & parapharma — devis sous 24h.',
  ADD COLUMN IF NOT EXISTS media_banner_cta_label text DEFAULT 'Découvrir Balooh',
  ADD COLUMN IF NOT EXISTS media_banner_cta_url text DEFAULT 'https://balooh.com/';