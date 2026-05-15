-- A. customers.stripe_customer_id
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_stripe_customer_id
  ON public.customers(stripe_customer_id);

-- B. order_invoices
CREATE TABLE IF NOT EXISTS public.order_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  stripe_invoice_id text UNIQUE,
  stripe_customer_id text,
  invoice_number text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','finalized','paid','failed')),
  amount_excl_vat numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  amount_incl_vat numeric NOT NULL DEFAULT 0,
  pdf_url text,
  hosted_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_invoices_order_vendor_unique UNIQUE (order_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_order_invoices_order_id ON public.order_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_order_invoices_vendor_id ON public.order_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_order_invoices_status ON public.order_invoices(status);

ALTER TABLE public.order_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage order_invoices" ON public.order_invoices;
CREATE POLICY "Admins manage order_invoices"
  ON public.order_invoices
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Customers read own order_invoices" ON public.order_invoices;
CREATE POLICY "Customers read own order_invoices"
  ON public.order_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.id = order_invoices.order_id
        AND c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors read own order_invoices" ON public.order_invoices;
CREATE POLICY "Vendors read own order_invoices"
  ON public.order_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = order_invoices.vendor_id
        AND v.auth_user_id = auth.uid()
    )
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS update_order_invoices_updated_at ON public.order_invoices;
CREATE TRIGGER update_order_invoices_updated_at
  BEFORE UPDATE ON public.order_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();