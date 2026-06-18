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
      AND v.auth_user_id = auth.uid()
  )
);