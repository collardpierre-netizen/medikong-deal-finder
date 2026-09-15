DROP POLICY IF EXISTS "NH users can view order items" ON public.nh_order_items;
CREATE POLICY "NH users can view order items"
ON public.nh_order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.nh_orders o
    WHERE o.id = nh_order_items.order_id
      AND public.has_any_nh_role(auth.uid(), o.nursing_home_id)
  )
);

DROP POLICY IF EXISTS "NH users can insert order items" ON public.nh_order_items;
CREATE POLICY "NH users can insert order items"
ON public.nh_order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.nh_orders o
    WHERE o.id = nh_order_items.order_id
      AND (
        public.has_nh_role(auth.uid(), o.nursing_home_id, 'soignant')
        OR public.has_nh_role(auth.uid(), o.nursing_home_id, 'admin_mr')
      )
  )
);