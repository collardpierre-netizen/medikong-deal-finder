-- Tighten public read policies on tables exposing sensitive business data

-- 1) offer_price_tiers: remove public SELECT, restrict to authenticated
DROP POLICY IF EXISTS "Offer price tiers publicly readable" ON public.offer_price_tiers;
CREATE POLICY "Offer price tiers readable by authenticated"
ON public.offer_price_tiers
FOR SELECT
TO authenticated
USING (true);
REVOKE SELECT ON public.offer_price_tiers FROM anon;

-- 2) external_vendors: remove public SELECT, restrict to admins (only admin pages use it)
DROP POLICY IF EXISTS "external_vendors_read" ON public.external_vendors;
CREATE POLICY "external_vendors_read_admin"
ON public.external_vendors
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));
REVOKE SELECT ON public.external_vendors FROM anon;

-- 3) restock_settings: remove public SELECT, restrict to authenticated
DROP POLICY IF EXISTS "Anyone can read restock settings" ON public.restock_settings;
CREATE POLICY "Authenticated can read restock settings"
ON public.restock_settings
FOR SELECT
TO authenticated
USING (true);
REVOKE SELECT ON public.restock_settings FROM anon;