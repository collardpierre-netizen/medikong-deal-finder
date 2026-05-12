
CREATE TABLE IF NOT EXISTS public.cms_partner_logos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  placement TEXT NOT NULL DEFAULT 'invest',
  name TEXT NOT NULL,
  website_url TEXT,
  logo_url TEXT,
  domain TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cms_partner_logos_placement ON public.cms_partner_logos(placement, sort_order) WHERE is_active = true;

ALTER TABLE public.cms_partner_logos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active partner logos" ON public.cms_partner_logos;
CREATE POLICY "Public read active partner logos"
  ON public.cms_partner_logos FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage partner logos" ON public.cms_partner_logos;
CREATE POLICY "Admins manage partner logos"
  ON public.cms_partner_logos FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE TRIGGER trg_cms_partner_logos_updated_at
  BEFORE UPDATE ON public.cms_partner_logos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial partners (only if table is empty)
INSERT INTO public.cms_partner_logos (placement, name, website_url, domain, sort_order)
SELECT * FROM (VALUES
  ('invest', 'Febelco',          'https://www.febelco.be/',                  'febelco.be',                  10),
  ('invest', 'Emeis',            'https://emeis.be/fr',                      'emeis.be',                    20),
  ('invest', 'Dynaphar',         'https://dynaphar.be/fr',                   'dynaphar.be',                 30),
  ('invest', 'Fixmer Pharma',    'https://www.fixmer-pharma.be/',            'fixmer-pharma.be',            40),
  ('invest', 'PharmaMed',        'https://www.pharmamed.be/',                'pharmamed.be',                50),
  ('invest', 'Newtech',          'https://newtech-ll.eu/',                   'newtech-ll.eu',               60),
  ('invest', 'BNA Santé',        'https://www.bnasantepolyclinique.be/',     'bnasantepolyclinique.be',     70),
  ('invest', 'Continuing Care',  'https://continuingcare.be/',               'continuingcare.be',           80)
) AS v(placement, name, website_url, domain, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_partner_logos WHERE placement = 'invest');
