CREATE POLICY "Admins read declared prices"
ON public.pharmacy_product_declared_prices
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));