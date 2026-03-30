
-- 1. Create translations table
CREATE TABLE public.translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  locale text NOT NULL,
  field text NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entity_type, entity_id, locale, field)
);

CREATE INDEX idx_translations_entity ON public.translations(entity_type, entity_id, locale);
CREATE INDEX idx_translations_locale ON public.translations(locale, entity_type);

-- 2. RLS
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Translations publicly readable"
ON public.translations FOR SELECT TO public
USING (true);

CREATE POLICY "Admins manage translations"
ON public.translations FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

-- 3. Trigger
CREATE TRIGGER set_translations_updated_at
  BEFORE UPDATE ON public.translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
