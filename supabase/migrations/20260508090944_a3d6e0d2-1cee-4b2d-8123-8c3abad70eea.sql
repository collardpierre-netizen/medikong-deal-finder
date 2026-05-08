
-- 1. Étendre la table categories existante
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS level smallint,
  ADD COLUMN IF NOT EXISTS is_featured_top boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_status_check') THEN
    ALTER TABLE public.categories ADD CONSTRAINT categories_status_check CHECK (status IN ('active','archived'));
  END IF;
END $$;

-- Backfill level: itératif via CTE récursive
WITH RECURSIVE tree AS (
  SELECT id, parent_id, 1::smallint AS lvl FROM public.categories WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.parent_id, (t.lvl + 1)::smallint
    FROM public.categories c JOIN tree t ON c.parent_id = t.id
)
UPDATE public.categories c SET level = t.lvl FROM tree t WHERE c.id = t.id AND c.level IS DISTINCT FROM t.lvl;

CREATE INDEX IF NOT EXISTS idx_categories_level_position ON public.categories(level, display_order);
CREATE INDEX IF NOT EXISTS idx_categories_featured_top ON public.categories(is_featured_top) WHERE is_featured_top;

-- 2. category_translations
CREATE TABLE IF NOT EXISTS public.category_translations (
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('fr','nl','en')),
  name text NOT NULL,
  description text,
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, locale)
);
CREATE INDEX IF NOT EXISTS idx_category_translations_locale_name ON public.category_translations(locale, name);

ALTER TABLE public.category_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "category_translations public read" ON public.category_translations;
CREATE POLICY "category_translations public read" ON public.category_translations FOR SELECT USING (true);

DROP POLICY IF EXISTS "category_translations admin write" ON public.category_translations;
CREATE POLICY "category_translations admin write" ON public.category_translations FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_category_translations_updated_at ON public.category_translations;
CREATE TRIGGER trg_category_translations_updated_at
  BEFORE UPDATE ON public.category_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill traductions depuis colonnes inline existantes
INSERT INTO public.category_translations (category_id, locale, name)
SELECT id, 'fr', name_fr FROM public.categories WHERE name_fr IS NOT NULL AND length(trim(name_fr)) > 0
ON CONFLICT (category_id, locale) DO NOTHING;

INSERT INTO public.category_translations (category_id, locale, name)
SELECT id, 'nl', name_nl FROM public.categories WHERE name_nl IS NOT NULL AND length(trim(name_nl)) > 0
ON CONFLICT (category_id, locale) DO NOTHING;

INSERT INTO public.category_translations (category_id, locale, name)
SELECT id, 'en', COALESCE(name_en, name) FROM public.categories WHERE COALESCE(name_en, name) IS NOT NULL
ON CONFLICT (category_id, locale) DO NOTHING;

-- RLS sur categories : ajouter politique admin (lecture publique probablement déjà en place via is_active)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories admin write" ON public.categories;
CREATE POLICY "categories admin write" ON public.categories FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- 3. category_source_aliases
CREATE TABLE IF NOT EXISTS public.category_source_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_path text NOT NULL,
  source_locale text,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_category_source_aliases_path_locale
  ON public.category_source_aliases(source_path, COALESCE(source_locale, ''));
CREATE INDEX IF NOT EXISTS idx_category_source_aliases_path ON public.category_source_aliases(source_path);

ALTER TABLE public.category_source_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "category_source_aliases admin all" ON public.category_source_aliases;
CREATE POLICY "category_source_aliases admin all" ON public.category_source_aliases FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- 4. products.primary_category_id
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS primary_category_id uuid REFERENCES public.categories(id);
CREATE INDEX IF NOT EXISTS idx_products_primary_category ON public.products(primary_category_id);

-- 5. Vue admin_unmapped_categories (basée sur products.category_name legacy)
CREATE OR REPLACE VIEW public.admin_unmapped_categories
WITH (security_invoker = true) AS
SELECT category_name AS source_path, count(*)::int AS products_count
  FROM public.products
 WHERE primary_category_id IS NULL
   AND category_name IS NOT NULL
   AND length(trim(category_name)) > 0
 GROUP BY category_name
 ORDER BY count(*) DESC;

-- 6. Seed 12 catégories maîtresses (UPSERT sur slug)
WITH seed(slug, position, icon, featured) AS (VALUES
  ('otc-medicaments',         1,  'pill',          true),
  ('dermatocosmetique',       2,  'sparkles',      true),
  ('hygiene-desinfection',    3,  'shield',        true),
  ('pansements-soins-plaies', 4,  'bandage',       true),
  ('diagnostic-mesure',       5,  'activity',      true),
  ('diabete',                 6,  'droplet',       true),
  ('incontinence',            7,  'shield-check',  false),
  ('orthopedie',              8,  'wheelchair',    false),
  ('soins-infirmiers',        9,  'syringe',       false),
  ('nutrition-complements',  10,  'apple',         false),
  ('maman-bebe',             11,  'baby',          false),
  ('cosmetique-parfumerie',  20,  'flower',        false)
)
INSERT INTO public.categories (slug, name, level, display_order, icon, is_featured_top, is_active, status)
SELECT s.slug, s.slug, 1, s.position, s.icon, s.featured, true, 'active' FROM seed s
ON CONFLICT (slug) DO UPDATE
  SET level = 1,
      display_order = EXCLUDED.display_order,
      icon = EXCLUDED.icon,
      is_featured_top = EXCLUDED.is_featured_top,
      is_active = true,
      status = 'active';

-- 7. Traductions niveau 1
WITH cats AS (
  SELECT id, slug FROM public.categories WHERE slug IN (
    'otc-medicaments','dermatocosmetique','hygiene-desinfection','pansements-soins-plaies',
    'diagnostic-mesure','diabete','incontinence','orthopedie','soins-infirmiers',
    'nutrition-complements','maman-bebe','cosmetique-parfumerie'
  )
),
trans(slug, locale, name) AS (VALUES
  ('otc-medicaments','fr','OTC & Médicaments à délivrance libre'),
  ('otc-medicaments','nl','OTC & Vrij verkrijgbare geneesmiddelen'),
  ('otc-medicaments','en','OTC & Over-the-counter medicines'),
  ('dermatocosmetique','fr','Dermatocosmétique'),
  ('dermatocosmetique','nl','Dermatocosmetica'),
  ('dermatocosmetique','en','Dermocosmetics'),
  ('hygiene-desinfection','fr','Hygiène & désinfection'),
  ('hygiene-desinfection','nl','Hygiëne & desinfectie'),
  ('hygiene-desinfection','en','Hygiene & disinfection'),
  ('pansements-soins-plaies','fr','Pansements & soins de plaies'),
  ('pansements-soins-plaies','nl','Verbanden & wondzorg'),
  ('pansements-soins-plaies','en','Dressings & wound care'),
  ('diagnostic-mesure','fr','Diagnostic & mesure'),
  ('diagnostic-mesure','nl','Diagnose & meting'),
  ('diagnostic-mesure','en','Diagnostics & measurement'),
  ('diabete','fr','Diabète'),
  ('diabete','nl','Diabetes'),
  ('diabete','en','Diabetes'),
  ('incontinence','fr','Incontinence'),
  ('incontinence','nl','Incontinentie'),
  ('incontinence','en','Incontinence'),
  ('orthopedie','fr','Orthopédie'),
  ('orthopedie','nl','Orthopedie'),
  ('orthopedie','en','Orthopedics'),
  ('soins-infirmiers','fr','Soins infirmiers'),
  ('soins-infirmiers','nl','Verpleegkundige zorg'),
  ('soins-infirmiers','en','Nursing care'),
  ('nutrition-complements','fr','Nutrition & compléments'),
  ('nutrition-complements','nl','Voeding & supplementen'),
  ('nutrition-complements','en','Nutrition & supplements'),
  ('maman-bebe','fr','Maman & bébé'),
  ('maman-bebe','nl','Mama & baby'),
  ('maman-bebe','en','Mom & baby'),
  ('cosmetique-parfumerie','fr','Cosmétique & parfumerie'),
  ('cosmetique-parfumerie','nl','Cosmetica & parfumerie'),
  ('cosmetique-parfumerie','en','Cosmetics & perfumery')
)
INSERT INTO public.category_translations (category_id, locale, name)
SELECT c.id, t.locale, t.name FROM trans t JOIN cats c ON c.slug = t.slug
ON CONFLICT (category_id, locale) DO UPDATE SET name = EXCLUDED.name;

-- Mettre à jour aussi name_fr/nl/en inline pour cohérence avec code legacy
UPDATE public.categories c
   SET name_fr = COALESCE((SELECT name FROM public.category_translations WHERE category_id = c.id AND locale='fr'), c.name_fr),
       name_nl = COALESCE((SELECT name FROM public.category_translations WHERE category_id = c.id AND locale='nl'), c.name_nl),
       name_en = COALESCE((SELECT name FROM public.category_translations WHERE category_id = c.id AND locale='en'), c.name_en),
       name    = COALESCE((SELECT name FROM public.category_translations WHERE category_id = c.id AND locale='fr'), c.name)
 WHERE c.slug IN (
    'otc-medicaments','dermatocosmetique','hygiene-desinfection','pansements-soins-plaies',
    'diagnostic-mesure','diabete','incontinence','orthopedie','soins-infirmiers',
    'nutrition-complements','maman-bebe','cosmetique-parfumerie'
 );

-- 8. Aliases initiaux
INSERT INTO public.category_source_aliases (source_path, source_locale, category_id, notes) VALUES
  ('Body Moisturizing > Body Lotion', 'en', (SELECT id FROM public.categories WHERE slug='dermatocosmetique'), NULL),
  ('Body Moisturizing',               'en', (SELECT id FROM public.categories WHERE slug='dermatocosmetique'), NULL),
  ('Anti-Aging',                      'en', (SELECT id FROM public.categories WHERE slug='dermatocosmetique'), NULL),
  ('Anti-âge',                        'fr', (SELECT id FROM public.categories WHERE slug='dermatocosmetique'), NULL),
  ('Acne',                            'en', (SELECT id FROM public.categories WHERE slug='dermatocosmetique'), NULL),
  ('Aftershave',                      'en', (SELECT id FROM public.categories WHERE slug='cosmetique-parfumerie'), NULL),
  ('Aftersun',                        'en', (SELECT id FROM public.categories WHERE slug='dermatocosmetique'), NULL),
  ('Aanbiedingen > Anti-âge > Peau',  'nl', (SELECT id FROM public.categories WHERE slug='dermatocosmetique'), NULL),
  ('Peau',                            'fr', (SELECT id FROM public.categories WHERE slug='dermatocosmetique'), NULL),
  ('Bio & naturel',                   'fr', (SELECT id FROM public.categories WHERE slug='nutrition-complements'), NULL),
  ('Petit matériel',                  'fr', (SELECT id FROM public.categories WHERE slug='soins-infirmiers'), NULL),
  ('Abattement – Désespoir > Fleurs de Bach > Bio & naturel', 'fr', (SELECT id FROM public.categories WHERE slug='nutrition-complements'), NULL),
  ('Accessoires > Accessoires',       'fr', NULL, 'ignored: catégorie poubelle'),
  ('Animal & Pet Repellents',         'en', NULL, 'ignored: hors scope officine'),
  ('Abattement – Désespoir',          'fr', NULL, 'ignored: catégorie ultra-spécifique non promouvable en hero'),
  ('Lunettes et verres',              'fr', NULL, 'ignored: à arbitrer en vague 2 (créer optique ?)')
ON CONFLICT (source_path, COALESCE(source_locale, '')) DO NOTHING;

-- 9. RPC apply_category_aliases — idempotent, admin only
CREATE OR REPLACE FUNCTION public.apply_category_aliases()
RETURNS TABLE(updated_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  UPDATE public.products p
     SET primary_category_id = a.category_id
    FROM public.category_source_aliases a
   WHERE p.primary_category_id IS NULL
     AND p.category_name = a.source_path
     AND a.category_id IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END $$;

REVOKE ALL ON FUNCTION public.apply_category_aliases() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_category_aliases() TO authenticated;
