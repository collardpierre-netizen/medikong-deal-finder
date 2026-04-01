
-- Table for granular vendor visibility rules
CREATE TABLE public.vendor_visibility_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  country_code text NULL,
  customer_type text NULL,
  show_real_name boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_vendor_visibility_vendor ON public.vendor_visibility_rules(vendor_id);
CREATE INDEX idx_vendor_visibility_lookup ON public.vendor_visibility_rules(vendor_id, country_code, customer_type);

-- Enable RLS
ALTER TABLE public.vendor_visibility_rules ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins manage vendor_visibility_rules"
  ON public.vendor_visibility_rules FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Public read for frontend resolution
CREATE POLICY "Vendor visibility rules publicly readable"
  ON public.vendor_visibility_rules FOR SELECT
  TO public
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_vendor_visibility_rules_updated_at
  BEFORE UPDATE ON public.vendor_visibility_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
