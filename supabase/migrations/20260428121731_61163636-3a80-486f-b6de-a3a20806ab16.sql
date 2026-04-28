-- ========================================
-- ÉTAPE 1 — Snapshots de sécurité AVANT tout ALTER
-- ========================================
CREATE TABLE IF NOT EXISTS public.products_backup_20260428_en AS
  SELECT * FROM public.products;

CREATE TABLE IF NOT EXISTS public.categories_backup_20260428_en AS
  SELECT * FROM public.categories;

CREATE TABLE IF NOT EXISTS public.brands_backup_20260428_en AS
  SELECT * FROM public.brands;

-- Verrouillage RLS sur les snapshots (conforme audit_backup_tables_rls)
ALTER TABLE public.products_backup_20260428_en ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories_backup_20260428_en ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands_backup_20260428_en ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.products_backup_20260428_en FROM anon, authenticated;
REVOKE ALL ON public.categories_backup_20260428_en FROM anon, authenticated;
REVOKE ALL ON public.brands_backup_20260428_en FROM anon, authenticated;

-- ========================================
-- ÉTAPE 2 — Colonnes _en (toutes nullable)
-- ========================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS short_description_en TEXT;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS description_en TEXT;

ALTER TABLE public.manufacturers
  ADD COLUMN IF NOT EXISTS description_en TEXT;

-- CMS (les tables peuvent ne pas exister selon environnement)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cms_hero_banners') THEN
    EXECUTE 'ALTER TABLE public.cms_hero_banners
      ADD COLUMN IF NOT EXISTS title_en TEXT,
      ADD COLUMN IF NOT EXISTS subtitle_en TEXT,
      ADD COLUMN IF NOT EXISTS cta_label_en TEXT';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cms_sections') THEN
    EXECUTE 'ALTER TABLE public.cms_sections
      ADD COLUMN IF NOT EXISTS title_en TEXT,
      ADD COLUMN IF NOT EXISTS body_en TEXT';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='restock_faq_items') THEN
    EXECUTE 'ALTER TABLE public.restock_faq_items
      ADD COLUMN IF NOT EXISTS question_en TEXT,
      ADD COLUMN IF NOT EXISTS answer_en TEXT';
  END IF;
END$$;