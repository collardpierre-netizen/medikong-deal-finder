
CREATE TABLE public.onboarding_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url text,
  quote text NOT NULL,
  name text NOT NULL,
  title text NOT NULL,
  gradient text NOT NULL DEFAULT 'linear-gradient(135deg, #1a365d, #2d3748, #1a202c)',
  role_visibility text NOT NULL DEFAULT 'both' CHECK (role_visibility IN ('buyer', 'seller', 'both')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Onboarding testimonials publicly readable"
  ON public.onboarding_testimonials FOR SELECT TO public USING (true);

CREATE POLICY "Admins manage onboarding testimonials"
  ON public.onboarding_testimonials FOR ALL TO authenticated
  USING (is_admin(auth.uid()));
