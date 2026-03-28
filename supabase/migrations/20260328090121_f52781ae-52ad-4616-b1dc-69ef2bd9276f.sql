CREATE TABLE public.onboarding_testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_url TEXT,
  quote TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  gradient TEXT NOT NULL DEFAULT 'linear-gradient(135deg, #1a365d, #2d3748, #1a202c)',
  role_visibility TEXT NOT NULL DEFAULT 'both' CHECK (role_visibility IN ('buyer', 'seller', 'both')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active testimonials"
ON public.onboarding_testimonials
FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Admins can manage testimonials"
ON public.onboarding_testimonials
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.onboarding_testimonials (quote, name, title, gradient, role_visibility, sort_order) VALUES
('MediKong nous a permis de centraliser nos achats de consommables avec une transparence totale sur les prix. Un vrai gain de temps au quotidien.', 'Dr. Sophie Claessens', 'Directrice médicale — Clinique Saint-Luc, Bruxelles', 'linear-gradient(135deg, #1a365d, #2d3748, #1a202c)', 'buyer', 0),
('Les délais de livraison sont fiables et le suivi est impeccable. Nos services peuvent enfin commander sans stress.', 'Philippe Lemaire', 'Responsable achats — CHU de Liège', 'linear-gradient(135deg, #064e3b, #1e3a5f, #1a202c)', 'buyer', 1),
('L''interface est intuitive, les prix sont clairs. J''ai trouvé tout mon matériel de rééducation en quelques clics.', 'Marie Vandenberghe', 'Kinésithérapeute indépendante — Gand', 'linear-gradient(135deg, #4c1d95, #1e3a5f, #1a202c)', 'buyer', 2),
('Depuis que nous vendons sur MediKong, notre CA B2B a augmenté de 35%. La plateforme est transparente et le support réactif.', 'Thomas Dubois', 'CEO — MedSupply Belgium', 'linear-gradient(135deg, #7c2d12, #1e3a5f, #1a202c)', 'seller', 0),
('Le dashboard vendeur est complet : suivi des commandes, analytics, gestion des offres. Tout est centralisé.', 'Isabelle Peeters', 'Directrice commerciale — Pharma Distri NV', 'linear-gradient(135deg, #064e3b, #1a365d, #1a202c)', 'seller', 1),
('MediKong nous a ouvert l''accès à des centaines de pharmacies belges que nous n''aurions jamais pu démarcher seuls.', 'Marc Janssen', 'Fondateur — BioMed Solutions', 'linear-gradient(135deg, #1e3a5f, #4c1d95, #1a202c)', 'seller', 2);