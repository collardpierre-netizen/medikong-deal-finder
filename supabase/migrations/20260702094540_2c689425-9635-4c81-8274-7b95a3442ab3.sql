-- ============================================================
-- Bibliothèque média centrale (Admin)
-- ============================================================

CREATE TABLE public.media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  width INTEGER,
  height INTEGER,
  sha256 TEXT NOT NULL,
  title TEXT,
  alt_text TEXT,
  description TEXT,
  folder TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] NOT NULL DEFAULT '{}',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX media_library_sha256_uniq ON public.media_library(sha256);
CREATE INDEX media_library_folder_idx ON public.media_library(folder);
CREATE INDEX media_library_tags_gin ON public.media_library USING GIN(tags);
CREATE INDEX media_library_created_idx ON public.media_library(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_library TO authenticated;
GRANT ALL ON public.media_library TO service_role;

ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access media_library"
  ON public.media_library FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE TRIGGER trg_media_library_updated_at
  BEFORE UPDATE ON public.media_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Rattachements polymorphes (produit / marque / offre / cms)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.media_link_entity AS ENUM ('product', 'brand', 'offer', 'cms');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.media_library_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media_library(id) ON DELETE CASCADE,
  entity_type public.media_link_entity NOT NULL,
  entity_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'gallery',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_id, entity_type, entity_id, role)
);

CREATE INDEX media_library_links_entity_idx
  ON public.media_library_links(entity_type, entity_id, sort_order);
CREATE INDEX media_library_links_media_idx
  ON public.media_library_links(media_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_library_links TO authenticated;
GRANT ALL ON public.media_library_links TO service_role;

ALTER TABLE public.media_library_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage media_library_links"
  ON public.media_library_links FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));