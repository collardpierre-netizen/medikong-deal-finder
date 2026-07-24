
-- 1) offers: replace public SELECT with verified-buyer/admin gate
DROP POLICY IF EXISTS "Offers read active public" ON public.offers;
CREATE POLICY "Offers read active verified"
ON public.offers
FOR SELECT
TO authenticated
USING (is_active = true AND public.is_verified_buyer_or_admin(auth.uid()));

-- 2) offer_price_tiers: same gate
DROP POLICY IF EXISTS "Public reads active offer price tiers" ON public.offer_price_tiers;
CREATE POLICY "Verified buyers read active offer price tiers"
ON public.offer_price_tiers
FOR SELECT
TO authenticated
USING (is_active = true AND public.is_verified_buyer_or_admin(auth.uid()));

-- 3) discount_tiers: restrict to verified buyers/admins
DROP POLICY IF EXISTS discount_tiers_read_authenticated ON public.discount_tiers;
CREATE POLICY discount_tiers_read_verified
ON public.discount_tiers
FOR SELECT
TO authenticated
USING (public.is_verified_buyer_or_admin(auth.uid()));

-- 4) product_country_stats: restrict to verified buyers/admins
DROP POLICY IF EXISTS "Product country stats publicly readable" ON public.product_country_stats;
CREATE POLICY "Product country stats read verified"
ON public.product_country_stats
FOR SELECT
TO authenticated
USING (public.is_verified_buyer_or_admin(auth.uid()));

-- Revoke anon SELECT grants that could bypass RLS-less roles or leave the door open.
REVOKE SELECT ON public.offers FROM anon;
REVOKE SELECT ON public.offer_price_tiers FROM anon;
REVOKE SELECT ON public.discount_tiers FROM anon;
REVOKE SELECT ON public.product_country_stats FROM anon;
