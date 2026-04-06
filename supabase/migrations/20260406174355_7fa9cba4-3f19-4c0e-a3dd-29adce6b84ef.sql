
-- 1. ENABLE RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_price_tiers ENABLE ROW LEVEL SECURITY;

-- 2. DROP BAD POLICIES
-- offers
DROP POLICY IF EXISTS "Allow anon delete offers" ON public.offers;
DROP POLICY IF EXISTS "Allow anon insert offers" ON public.offers;
DROP POLICY IF EXISTS "Allow anon select offers" ON public.offers;
DROP POLICY IF EXISTS "Allow anon update offers" ON public.offers;
DROP POLICY IF EXISTS "Offers publicly readable" ON public.offers;
-- offer_price_tiers
DROP POLICY IF EXISTS "Allow anon delete offer_price_tiers" ON public.offer_price_tiers;
DROP POLICY IF EXISTS "Allow anon insert offer_price_tiers" ON public.offer_price_tiers;
DROP POLICY IF EXISTS "Allow anon update offer_price_tiers" ON public.offer_price_tiers;
DROP POLICY IF EXISTS "Allow public read offer_price_tiers" ON public.offer_price_tiers;
-- discount_tiers
DROP POLICY IF EXISTS "discount_tiers_service" ON public.discount_tiers;
-- vendors
DROP POLICY IF EXISTS "Allow anon insert vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow anon select vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow anon update vendors" ON public.vendors;
-- crm
DROP POLICY IF EXISTS "Authenticated users can manage campaigns" ON public.crm_campaigns;
DROP POLICY IF EXISTS "Authenticated users can manage messages" ON public.crm_messages;

-- 3. DROP existing to avoid conflicts, then recreate
DROP POLICY IF EXISTS "Offers read active" ON public.offers;
DROP POLICY IF EXISTS "Service role manages offers" ON public.offers;
DROP POLICY IF EXISTS "Offer price tiers publicly readable" ON public.offer_price_tiers;
DROP POLICY IF EXISTS "Admins manage offer_price_tiers" ON public.offer_price_tiers;
DROP POLICY IF EXISTS "Service role manages offer_price_tiers" ON public.offer_price_tiers;
DROP POLICY IF EXISTS "Admins manage discount_tiers" ON public.discount_tiers;
DROP POLICY IF EXISTS "Service role manages discount_tiers" ON public.discount_tiers;
DROP POLICY IF EXISTS "Admins manage crm_campaigns" ON public.crm_campaigns;
DROP POLICY IF EXISTS "Admins manage crm_messages" ON public.crm_messages;

-- 4. OFFERS
CREATE POLICY "Offers read active"
  ON public.offers FOR SELECT TO public
  USING (is_active = true);

CREATE POLICY "Service role manages offers"
  ON public.offers FOR ALL TO public
  USING (auth.role() = 'service_role');

-- 5. OFFER_PRICE_TIERS
CREATE POLICY "Offer price tiers publicly readable"
  ON public.offer_price_tiers FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins manage offer_price_tiers"
  ON public.offer_price_tiers FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Service role manages offer_price_tiers"
  ON public.offer_price_tiers FOR ALL TO public
  USING (auth.role() = 'service_role');

-- 6. DISCOUNT_TIERS
CREATE POLICY "Admins manage discount_tiers"
  ON public.discount_tiers FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Service role manages discount_tiers"
  ON public.discount_tiers FOR ALL TO public
  USING (auth.role() = 'service_role');

-- 7. CRM - admin only
CREATE POLICY "Admins manage crm_campaigns"
  ON public.crm_campaigns FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins manage crm_messages"
  ON public.crm_messages FOR ALL TO authenticated
  USING (is_admin(auth.uid()));
