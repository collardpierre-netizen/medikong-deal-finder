DROP POLICY IF EXISTS "Vendors read own order lines" ON public.order_lines;

CREATE POLICY "Vendors read own order lines"
ON public.order_lines
FOR SELECT
TO authenticated
USING (
  vendor_id IN (
    SELECT id
    FROM public.vendors
    WHERE auth_user_id = auth.uid()
  )
  OR vendor_id IN (
    SELECT public.current_user_vendor_account_ids()
  )
);

DROP POLICY IF EXISTS "Vendors read orders with their lines" ON public.orders;

CREATE POLICY "Vendors read orders with their lines"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.order_lines ol
    JOIN public.vendors v ON v.id = ol.vendor_id
    WHERE ol.order_id = orders.id
      AND (
        v.auth_user_id = auth.uid()
        OR v.id IN (
          SELECT public.current_user_vendor_account_ids()
        )
      )
  )
);