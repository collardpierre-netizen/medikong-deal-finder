
-- Delegate type enum
CREATE TYPE public.delegate_type AS ENUM ('commercial', 'contact_referent');

-- Delegates table
CREATE TABLE public.delegates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  photo_url TEXT,
  delegate_type public.delegate_type NOT NULL DEFAULT 'commercial',
  zones TEXT[] DEFAULT '{}',
  specialties TEXT[] DEFAULT '{}',
  bio TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delegates ENABLE ROW LEVEL SECURITY;

-- Public read for visible delegates
CREATE POLICY "Anyone can view visible delegates"
  ON public.delegates FOR SELECT
  USING (is_visible = true);

-- Admin full access
CREATE POLICY "Admins can manage delegates"
  ON public.delegates FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Auto-update updated_at
CREATE TRIGGER update_delegates_updated_at
  BEFORE UPDATE ON public.delegates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Assignment link table
CREATE TYPE public.delegate_entity_type AS ENUM ('brand', 'manufacturer', 'vendor');

CREATE TABLE public.delegate_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delegate_id UUID NOT NULL REFERENCES public.delegates(id) ON DELETE CASCADE,
  entity_type public.delegate_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delegate_assignments ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can view delegate assignments"
  ON public.delegate_assignments FOR SELECT
  USING (true);

-- Admin full access
CREATE POLICY "Admins can manage delegate assignments"
  ON public.delegate_assignments FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Unique constraint: one primary per entity
CREATE UNIQUE INDEX idx_delegate_assignments_unique
  ON public.delegate_assignments (delegate_id, entity_type, entity_id);
