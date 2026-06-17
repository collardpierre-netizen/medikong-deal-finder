DROP POLICY IF EXISTS ps_vendor_insert_own ON public.product_submissions;
CREATE POLICY ps_vendor_insert_own
ON public.product_submissions
FOR INSERT
TO authenticated
WITH CHECK (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));