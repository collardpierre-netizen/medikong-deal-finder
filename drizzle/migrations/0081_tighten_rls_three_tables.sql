DROP POLICY IF EXISTS "Price history readable by authenticated" ON public.price_history;
CREATE POLICY "Price history readable by verified buyers" ON public.price_history FOR SELECT TO authenticated USING (public.is_verified_buyer_or_admin(auth.uid()));

DROP POLICY IF EXISTS "KYC criteria publicly readable" ON public.vendor_kyc_criteria;
CREATE POLICY "Active KYC criteria readable by signed-in users" ON public.vendor_kyc_criteria FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "public_read_profile_visibility" ON public.profile_visibility;
CREATE POLICY "signed_in_read_profile_visibility" ON public.profile_visibility FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);