DROP POLICY IF EXISTS "Authenticated users can read product_prices" ON public.product_prices;
CREATE POLICY "Verified buyers and admins can read product_prices"
ON public.product_prices
FOR SELECT
TO authenticated
USING (public.is_verified_buyer_or_admin());