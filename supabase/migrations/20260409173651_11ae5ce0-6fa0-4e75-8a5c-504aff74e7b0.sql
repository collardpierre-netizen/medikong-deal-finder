
-- Vendor-level default MOV/MOQ per profile and country
CREATE TABLE public.vendor_profile_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  profile_type text NOT NULL,
  country_code text NOT NULL DEFAULT 'BE',
  default_mov numeric NOT NULL DEFAULT 0,
  default_mov_currency text NOT NULL DEFAULT 'EUR',
  default_moq integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, profile_type, country_code)
);

ALTER TABLE public.vendor_profile_defaults ENABLE ROW LEVEL SECURITY;

-- Vendors can read/write their own defaults
CREATE POLICY "Vendors manage own profile defaults"
ON public.vendor_profile_defaults FOR ALL TO authenticated
USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()))
WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

-- Admins full access
CREATE POLICY "Admins manage all profile defaults"
ON public.vendor_profile_defaults FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_vendor_profile_defaults_updated_at
BEFORE UPDATE ON public.vendor_profile_defaults
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
