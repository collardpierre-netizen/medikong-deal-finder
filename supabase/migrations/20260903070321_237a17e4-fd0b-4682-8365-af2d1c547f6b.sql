ALTER TABLE public.order_invoices DROP CONSTRAINT IF EXISTS order_invoices_type_check;
ALTER TABLE public.order_invoices ADD CONSTRAINT order_invoices_type_check CHECK (type = ANY (ARRAY['self_billing'::text, 'commission'::text, 'manual'::text]));
ALTER TABLE public.order_invoices ALTER COLUMN vendor_id DROP NOT NULL;

DROP POLICY IF EXISTS "Customers read own self_billing order_invoices" ON public.order_invoices;
CREATE POLICY "Customers read own order_invoices" ON public.order_invoices
FOR SELECT TO authenticated
USING (
  type IN ('self_billing', 'manual')
  AND EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE o.id = order_invoices.order_id AND c.auth_user_id = auth.uid()
  )
);