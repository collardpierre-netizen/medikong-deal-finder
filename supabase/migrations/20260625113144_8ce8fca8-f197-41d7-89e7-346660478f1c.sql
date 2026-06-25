
CREATE TABLE public.customer_shipping_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label text NOT NULL,
  contact_name text,
  contact_phone text,
  contact_email text,
  address_l1 text NOT NULL,
  address_l2 text,
  postal_code text,
  city text,
  country_code text NOT NULL DEFAULT 'BE',
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_shipping_addresses TO authenticated;
GRANT ALL ON public.customer_shipping_addresses TO service_role;

ALTER TABLE public.customer_shipping_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage customer shipping addresses"
  ON public.customer_shipping_addresses FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_customer_shipping_addresses_customer ON public.customer_shipping_addresses(customer_id);

CREATE UNIQUE INDEX uq_customer_shipping_default
  ON public.customer_shipping_addresses(customer_id)
  WHERE is_default = true;

CREATE TRIGGER trg_customer_shipping_addresses_updated_at
  BEFORE UPDATE ON public.customer_shipping_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders
  ADD COLUMN shipping_address_id uuid REFERENCES public.customer_shipping_addresses(id) ON DELETE SET NULL;
