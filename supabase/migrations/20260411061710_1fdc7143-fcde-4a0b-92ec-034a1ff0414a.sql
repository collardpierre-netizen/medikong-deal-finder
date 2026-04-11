
-- 1. Create vendor shipping mode enum
CREATE TYPE public.vendor_shipping_mode AS ENUM ('no_shipping', 'own_sendcloud', 'medikong_whitelabel');

-- 2. Create shipment status enum
CREATE TYPE public.shipment_status AS ENUM ('pending', 'created', 'announced', 'in_transit', 'delivered', 'exception', 'cancelled');

-- 3. Create shipping invoice status enum
CREATE TYPE public.shipping_invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue');

-- 4. Add shipping mode to vendors
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS vendor_shipping_mode public.vendor_shipping_mode NOT NULL DEFAULT 'no_shipping',
  ADD COLUMN IF NOT EXISTS shipping_margin_percentage numeric NOT NULL DEFAULT 15;

-- 5. Vendor Sendcloud credentials (for own_sendcloud mode)
CREATE TABLE public.vendor_sendcloud_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  sendcloud_public_key text NOT NULL DEFAULT '',
  sendcloud_secret_key text NOT NULL DEFAULT '',
  is_connected boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id)
);

ALTER TABLE public.vendor_sendcloud_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors read own sendcloud credentials"
  ON public.vendor_sendcloud_credentials FOR SELECT
  TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Vendors update own sendcloud credentials"
  ON public.vendor_sendcloud_credentials FOR UPDATE
  TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Vendors insert own sendcloud credentials"
  ON public.vendor_sendcloud_credentials FOR INSERT
  TO authenticated
  WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admins manage all sendcloud credentials"
  ON public.vendor_sendcloud_credentials FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 6. Vendor shipping addresses
CREATE TABLE public.vendor_shipping_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Entrepôt principal',
  name text NOT NULL DEFAULT '',
  company_name text NOT NULL DEFAULT '',
  address_line_1 text NOT NULL DEFAULT '',
  address_line_2 text,
  house_number text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'BE',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_shipping_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors read own shipping addresses"
  ON public.vendor_shipping_addresses FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Vendors manage own shipping addresses"
  ON public.vendor_shipping_addresses FOR ALL TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admins manage all shipping addresses"
  ON public.vendor_shipping_addresses FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 7. Shipments
CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_reference text NOT NULL,
  shipping_mode_used public.vendor_shipping_mode NOT NULL,
  parcel_id integer,
  tracking_number text,
  tracking_url text,
  carrier text,
  status public.shipment_status NOT NULL DEFAULT 'pending',
  recipient_name text NOT NULL DEFAULT '',
  recipient_email text,
  recipient_phone text,
  recipient_address jsonb NOT NULL DEFAULT '{}',
  weight_grams integer,
  dimensions_cm jsonb,
  cost_base_cents integer,
  cost_margin_cents integer,
  cost_total_cents integer,
  label_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors read own shipments"
  ON public.shipments FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Vendors create own shipments"
  ON public.shipments FOR INSERT TO authenticated
  WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Vendors update own shipments"
  ON public.shipments FOR UPDATE TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admins manage all shipments"
  ON public.shipments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_shipments_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Shipment events
CREATE TABLE public.shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  sendcloud_event_id text,
  event_type text NOT NULL,
  event_message text NOT NULL DEFAULT '',
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_events_sendcloud_id
  ON public.shipment_events(sendcloud_event_id) WHERE sendcloud_event_id IS NOT NULL;

ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors read own shipment events"
  ON public.shipment_events FOR SELECT TO authenticated
  USING (shipment_id IN (
    SELECT s.id FROM public.shipments s
    JOIN public.vendors v ON v.id = s.vendor_id
    WHERE v.auth_user_id = auth.uid()
  ));

CREATE POLICY "Admins manage all shipment events"
  ON public.shipment_events FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 9. Shipping invoices (whitelabel billing)
CREATE TABLE public.shipping_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_base_cents integer NOT NULL DEFAULT 0,
  total_margin_cents integer NOT NULL DEFAULT 0,
  total_invoiced_cents integer NOT NULL DEFAULT 0,
  shipment_count integer NOT NULL DEFAULT 0,
  status public.shipping_invoice_status NOT NULL DEFAULT 'draft',
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE public.shipping_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors read own shipping invoices"
  ON public.shipping_invoices FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admins manage all shipping invoices"
  ON public.shipping_invoices FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- Indexes
CREATE INDEX idx_shipments_vendor_id ON public.shipments(vendor_id);
CREATE INDEX idx_shipments_status ON public.shipments(status);
CREATE INDEX idx_shipment_events_shipment_id ON public.shipment_events(shipment_id);
CREATE INDEX idx_shipping_invoices_vendor_id ON public.shipping_invoices(vendor_id);
