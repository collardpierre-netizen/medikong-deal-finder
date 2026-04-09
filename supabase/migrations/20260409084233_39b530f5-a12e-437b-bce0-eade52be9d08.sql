
-- Add shipping columns to vendors table
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS sendcloud_sender_address_id text,
  ADD COLUMN IF NOT EXISTS sendcloud_brand_id text,
  ADD COLUMN IF NOT EXISTS shipping_onboarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_address_line1 text,
  ADD COLUMN IF NOT EXISTS shipping_address_line2 text,
  ADD COLUMN IF NOT EXISTS shipping_postal_code text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_country text DEFAULT 'BE',
  ADD COLUMN IF NOT EXISTS shipping_contact_name text,
  ADD COLUMN IF NOT EXISTS shipping_phone text,
  ADD COLUMN IF NOT EXISTS shipping_email text,
  ADD COLUMN IF NOT EXISTS shipping_pickup_instructions text,
  ADD COLUMN IF NOT EXISTS shipping_logo_url text,
  ADD COLUMN IF NOT EXISTS commissionnaire_agreement_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS commissionnaire_agreement_version text;

-- Shipments table
CREATE TABLE IF NOT EXISTS public.restock_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.restock_transactions(id),
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  sendcloud_parcel_id text UNIQUE,
  sendcloud_tracking_number text,
  sendcloud_tracking_url text,
  sendcloud_label_url text,
  carrier text,
  weight_g integer,
  declared_value_cents integer,
  sendcloud_cost_cents integer,
  medikong_margin_pct numeric(5,2),
  medikong_margin_cents integer,
  seller_charge_cents integer,
  buyer_shipping_fee_cents integer,
  status text DEFAULT 'created',
  status_updated_at timestamptz,
  exception_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.restock_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors view own shipments" ON public.restock_shipments
  FOR SELECT TO authenticated
  USING (seller_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Buyers view own shipments" ON public.restock_shipments
  FOR SELECT TO authenticated
  USING (buyer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admins manage all shipments" ON public.restock_shipments
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- Shipment events (webhook log, idempotent)
CREATE TABLE IF NOT EXISTS public.restock_shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid REFERENCES public.restock_shipments(id),
  sendcloud_parcel_id text,
  event_type text,
  event_message text,
  event_timestamp timestamptz,
  sendcloud_event_id text UNIQUE,
  raw_payload jsonb,
  processed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment ON public.restock_shipment_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_events_type ON public.restock_shipment_events(event_type);

ALTER TABLE public.restock_shipment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors view own shipment events" ON public.restock_shipment_events
  FOR SELECT TO authenticated
  USING (shipment_id IN (
    SELECT id FROM public.restock_shipments WHERE seller_id IN (
      SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()
    )
  ));

CREATE POLICY "Admins manage all events" ON public.restock_shipment_events
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- Shipment incidents
CREATE TABLE IF NOT EXISTS public.restock_shipment_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid REFERENCES public.restock_shipments(id),
  reported_by uuid,
  incident_type text,
  description text,
  photos text[],
  status text DEFAULT 'open',
  sendcloud_claim_id text,
  indemnity_cents integer,
  indemnity_paid_to uuid,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.restock_shipment_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own incidents" ON public.restock_shipment_incidents
  FOR SELECT TO authenticated
  USING (
    reported_by = auth.uid()
    OR shipment_id IN (
      SELECT id FROM public.restock_shipments WHERE seller_id IN (
        SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users create incidents" ON public.restock_shipment_incidents
  FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());

CREATE POLICY "Admins manage all incidents" ON public.restock_shipment_incidents
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- Sendcloud invoice reconciliation
CREATE TABLE IF NOT EXISTS public.restock_sendcloud_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  period_start date,
  period_end date,
  total_cents integer,
  total_vat_cents integer,
  total_ttc_cents integer,
  pdf_url text,
  reconciled boolean DEFAULT false,
  reconciled_at timestamptz,
  reconciled_by uuid,
  unmatched_cents integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.restock_sendcloud_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invoices" ON public.restock_sendcloud_invoices
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.restock_sendcloud_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sendcloud_invoice_id uuid REFERENCES public.restock_sendcloud_invoices(id),
  shipment_id uuid REFERENCES public.restock_shipments(id),
  sendcloud_parcel_id text,
  line_cost_cents integer,
  vat_rate numeric(5,2),
  matched boolean DEFAULT false,
  notes text
);

ALTER TABLE public.restock_sendcloud_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invoice lines" ON public.restock_sendcloud_invoice_lines
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- API call logs for monitoring
CREATE TABLE IF NOT EXISTS public.restock_sendcloud_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  operation text NOT NULL,
  status_code integer,
  duration_ms integer,
  error_message text,
  called_at timestamptz DEFAULT now()
);

ALTER TABLE public.restock_sendcloud_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view logs" ON public.restock_sendcloud_api_logs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
