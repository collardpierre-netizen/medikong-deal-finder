
CREATE TABLE public.vendor_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Principal',
  address_line1 TEXT NOT NULL,
  house_number TEXT,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'BE',
  phone TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sendcloud_sender_address_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can manage own addresses"
ON public.vendor_addresses FOR ALL
TO authenticated
USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()))
WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admins can manage all addresses"
ON public.vendor_addresses FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_vendor_addresses_updated_at
BEFORE UPDATE ON public.vendor_addresses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.vendor_notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE UNIQUE,
  notify_shipment_created BOOLEAN NOT NULL DEFAULT true,
  notify_shipment_delivered BOOLEAN NOT NULL DEFAULT true,
  notify_shipment_exception BOOLEAN NOT NULL DEFAULT true,
  notify_invoice_ready BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can manage own notification settings"
ON public.vendor_notification_settings FOR ALL
TO authenticated
USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()))
WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admins can manage all notification settings"
ON public.vendor_notification_settings FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_vendor_notification_settings_updated_at
BEFORE UPDATE ON public.vendor_notification_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
