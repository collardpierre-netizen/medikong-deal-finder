-- ============================================================
-- PR 8 : Studio PLV — media_assets + media_downloads + Storage
-- ============================================================

-- Enum visibility (avec premium gardé pour préparer la suite)
DO $$ BEGIN
  CREATE TYPE public.media_visibility AS ENUM ('public', 'authenticated', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.media_asset_type AS ENUM ('catalogue', 'affiche', 'video', 'fiche', 'brochure');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- media_assets
-- ============================================================
CREATE TABLE public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE CASCADE,
  asset_type public.media_asset_type NOT NULL,
  language TEXT NOT NULL DEFAULT 'fr',
  visibility public.media_visibility NOT NULL DEFAULT 'authenticated',
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  thumbnail_path TEXT,
  duration_seconds INTEGER,
  page_count INTEGER,
  tags TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_assets_xor_owner CHECK (
    (brand_id IS NOT NULL AND manufacturer_id IS NULL)
    OR (brand_id IS NULL AND manufacturer_id IS NOT NULL)
  ),
  CONSTRAINT media_assets_language_check CHECK (language IN ('fr', 'nl', 'en', 'de'))
);

CREATE INDEX idx_media_assets_brand ON public.media_assets(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX idx_media_assets_manufacturer ON public.media_assets(manufacturer_id) WHERE manufacturer_id IS NOT NULL;
CREATE INDEX idx_media_assets_type ON public.media_assets(asset_type);
CREATE INDEX idx_media_assets_visibility ON public.media_assets(visibility) WHERE is_active = true;
CREATE INDEX idx_media_assets_active_sort ON public.media_assets(is_active, sort_order);
CREATE INDEX idx_media_assets_tags ON public.media_assets USING GIN(tags);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- Anon : seulement médias 'public' actifs
CREATE POLICY "Anon can view public active media"
  ON public.media_assets FOR SELECT TO anon
  USING (is_active = true AND visibility = 'public');

-- Authenticated : médias 'public' + 'authenticated' actifs
CREATE POLICY "Authenticated can view public+auth active media"
  ON public.media_assets FOR SELECT TO authenticated
  USING (is_active = true AND visibility IN ('public', 'authenticated'));

-- Admins : tout
CREATE POLICY "Admins manage media assets"
  ON public.media_assets FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE TRIGGER trg_media_assets_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- media_downloads (journal pour analytics)
-- ============================================================
CREATE TABLE public.media_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  country_code TEXT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_downloads_asset ON public.media_downloads(media_asset_id);
CREATE INDEX idx_media_downloads_profile ON public.media_downloads(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_media_downloads_date ON public.media_downloads(downloaded_at DESC);

ALTER TABLE public.media_downloads ENABLE ROW LEVEL SECURITY;

-- Insert via edge function (service_role bypass) — pas de policy INSERT publique
-- Admins : lecture complète pour analytics
CREATE POLICY "Admins read media downloads"
  ON public.media_downloads FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- ============================================================
-- Storage bucket privé
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-assets', 'media-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Lecture : admins uniquement (le reste passe par signed URL via edge function service_role)
CREATE POLICY "Admins read media-assets bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'media-assets'
    AND (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  );

CREATE POLICY "Admins upload media-assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media-assets'
    AND (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  );

CREATE POLICY "Admins update media-assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media-assets'
    AND (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  );

CREATE POLICY "Admins delete media-assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'media-assets'
    AND (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  );