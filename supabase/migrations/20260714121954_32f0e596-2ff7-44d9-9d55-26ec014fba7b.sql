ALTER TABLE public.order_invoices
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'self_billing',
  ADD COLUMN IF NOT EXISTS pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.order_invoices DROP CONSTRAINT IF EXISTS order_invoices_type_check;
ALTER TABLE public.order_invoices ADD CONSTRAINT order_invoices_type_check
  CHECK (type IN ('self_billing', 'commission'));

ALTER TABLE public.order_invoices DROP CONSTRAINT IF EXISTS order_invoices_order_vendor_unique;
ALTER TABLE public.order_invoices DROP CONSTRAINT IF EXISTS order_invoices_order_vendor_type_unique;
ALTER TABLE public.order_invoices ADD CONSTRAINT order_invoices_order_vendor_type_unique
  UNIQUE (order_id, vendor_id, type);

ALTER TABLE public.order_invoices DROP CONSTRAINT IF EXISTS order_invoices_status_check;
ALTER TABLE public.order_invoices ADD CONSTRAINT order_invoices_status_check
  CHECK (status IN ('pending','generated','finalized','paid','failed'));

-- Restrict customer read to self_billing only
DROP POLICY IF EXISTS "Customers read own order_invoices" ON public.order_invoices;
CREATE POLICY "Customers read own self_billing order_invoices"
  ON public.order_invoices
  FOR SELECT
  TO authenticated
  USING (
    type = 'self_billing'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.id = order_invoices.order_id
        AND c.auth_user_id = auth.uid()
    )
  );

-- Vendors can read their own invoices (both types)
DROP POLICY IF EXISTS "Vendors read own order_invoices" ON public.order_invoices;
CREATE POLICY "Vendors read own order_invoices"
  ON public.order_invoices
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()
    )
  );