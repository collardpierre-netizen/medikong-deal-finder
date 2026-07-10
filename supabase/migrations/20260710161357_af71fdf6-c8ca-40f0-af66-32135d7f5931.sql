DROP POLICY IF EXISTS "Vendors read own order_invoices" ON public.order_invoices;

CREATE POLICY "Vendors read own order_invoices"
ON public.order_invoices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = order_invoices.vendor_id
      AND v.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.account_memberships m
    WHERE m.user_id = auth.uid()
      AND m.account_kind = 'vendor'
      AND m.status = 'active'
      AND m.account_id = order_invoices.vendor_id
  )
);