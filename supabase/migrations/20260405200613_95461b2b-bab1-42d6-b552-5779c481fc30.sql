
-- Commercial settings for each vendor
CREATE TABLE public.vendor_commercial_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL UNIQUE REFERENCES public.vendors(id) ON DELETE CASCADE,
  target_countries text[] NOT NULL DEFAULT '{BE}',
  target_customer_types text[] NOT NULL DEFAULT '{}',
  default_mov numeric DEFAULT 0,
  default_mov_currency text DEFAULT 'EUR',
  default_delivery_days integer DEFAULT 3,
  shipping_zones text[] DEFAULT '{Benelux}',
  shipping_from_country text DEFAULT 'BE',
  return_policy text,
  warranty_info text,
  payment_terms_note text,
  is_dropshipping boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_commercial_settings ENABLE ROW LEVEL SECURITY;

-- Vendors can read/update their own settings
CREATE POLICY "Vendors manage own commercial settings"
ON public.vendor_commercial_settings
FOR ALL
TO authenticated
USING (vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid()))
WITH CHECK (vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid()));

-- Admins full access
CREATE POLICY "Admins manage all commercial settings"
ON public.vendor_commercial_settings
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Auto-update timestamp
CREATE TRIGGER update_vendor_commercial_settings_updated_at
BEFORE UPDATE ON public.vendor_commercial_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
