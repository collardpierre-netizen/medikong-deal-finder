-- 1. brand_official_distributors : lecture réservée aux utilisateurs connectés
DROP POLICY IF EXISTS "Public read brand distributors" ON public.brand_official_distributors;
CREATE POLICY "Authenticated read brand distributors"
ON public.brand_official_distributors
FOR SELECT
TO authenticated
USING (is_active = true);
REVOKE SELECT ON public.brand_official_distributors FROM anon;

-- 2. vendor_brand_authorizations : lecture réservée aux utilisateurs connectés
DROP POLICY IF EXISTS "vba_public_read" ON public.vendor_brand_authorizations;
CREATE POLICY "vba_authenticated_read"
ON public.vendor_brand_authorizations
FOR SELECT
TO authenticated
USING (true);
REVOKE SELECT ON public.vendor_brand_authorizations FROM anon;

-- 3. market_prices : vendeurs uniquement avec accès Veille marché actif
DROP POLICY IF EXISTS "vendors_and_admins_read_market_prices" ON public.market_prices;
CREATE POLICY "vendors_with_intel_and_admins_read_market_prices"
ON public.market_prices
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.auth_user_id = auth.uid()
      AND v.is_active = true
      AND public.vendor_market_intel_access(v.id)
  )
);
REVOKE SELECT ON public.market_prices FROM anon;