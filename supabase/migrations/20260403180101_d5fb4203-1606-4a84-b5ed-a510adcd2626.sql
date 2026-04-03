
-- Create profession_types table
CREATE TABLE public.profession_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Briefcase',
  default_category_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profession_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profession types publicly readable"
  ON public.profession_types FOR SELECT TO public USING (true);

CREATE POLICY "Admins manage profession_types"
  ON public.profession_types FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- Insert default profession types
INSERT INTO public.profession_types (name, description, icon, sort_order) VALUES
  ('Pharmacie d''officine', 'Officine, pharmacie en ligne, préparatoire', 'Pill', 1),
  ('Cabinet dentaire', 'Dentiste, orthodontiste, chirurgien-dentiste', 'Smile', 2),
  ('Maison de repos / MRS', 'EHPAD, MR, MRS, résidence seniors', 'Home', 3),
  ('Hôpital / Clinique', 'Hôpital, clinique privée, polyclinique', 'Building2', 4),
  ('Kinésithérapeute', 'Kiné, ostéopathe, rééducation fonctionnelle', 'Activity', 5),
  ('Médecin généraliste', 'Médecin de famille, cabinet médical', 'Stethoscope', 6),
  ('Institut de beauté / Spa', 'Esthétique, spa, dermocosmétique', 'Sparkles', 7),
  ('Podologue', 'Podologie, pédicure médicale', 'Footprints', 8),
  ('Vétérinaire', 'Cabinet vétérinaire, clinique animale', 'Heart', 9),
  ('Autre professionnel', 'Autre type d''établissement de santé', 'Briefcase', 10);

-- Add columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN profession_type_id UUID REFERENCES public.profession_types(id),
  ADD COLUMN category_preferences JSONB DEFAULT NULL,
  ADD COLUMN filter_mode TEXT NOT NULL DEFAULT 'filtered';
