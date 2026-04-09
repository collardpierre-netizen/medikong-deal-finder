
-- Fix security definer views by recreating with SECURITY INVOKER
CREATE OR REPLACE VIEW public.public_vendors
WITH (security_invoker = true)
AS
SELECT id, name, slug, description, logo_url, is_active
FROM public.vendors
WHERE is_active = true;

CREATE OR REPLACE VIEW public.public_offers
WITH (security_invoker = true)
AS
SELECT id, product_id, vendor_id, price_excl_vat, price_incl_vat,
       vat_rate, stock_quantity, stock_status, moq, mov, mov_amount, mov_currency,
       delivery_days, min_delivery_days, max_delivery_days, estimated_delivery_days,
       shipping_from_country, country_code, is_active, is_top_seller,
       has_extended_delivery, down_payment_pct, created_at, updated_at
FROM public.offers
WHERE is_active = true;

-- Fix external_leads INSERT: require user_id = auth.uid()
DROP POLICY IF EXISTS "external_leads_insert_authenticated" ON public.external_leads;

CREATE POLICY "external_leads_insert_authenticated"
ON public.external_leads FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
