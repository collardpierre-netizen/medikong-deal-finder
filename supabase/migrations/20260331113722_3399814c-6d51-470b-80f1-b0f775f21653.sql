-- Allow admins to manage external_vendors (insert, update, delete)
CREATE POLICY "Admins manage external_vendors"
ON public.external_vendors
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Allow admins to manage external_offers (insert, update, delete)
CREATE POLICY "Admins manage external_offers"
ON public.external_offers
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));