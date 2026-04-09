
-- 3. FIX EXTERNAL_LEADS: insert scoped to own user
DROP POLICY IF EXISTS "external_leads_insert" ON public.external_leads;
DROP POLICY IF EXISTS "Authenticated insert own external_leads" ON public.external_leads;

CREATE POLICY "Authenticated insert own external_leads"
ON public.external_leads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. FIX RESTOCK_RATINGS: Remove overly permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create ratings" ON public.restock_ratings;

-- 5. FIX ORDER_LINES: Replace customer policy to hide cost fields
DROP POLICY IF EXISTS "Customers read own order lines" ON public.order_lines;
DROP POLICY IF EXISTS "Admins read all order lines" ON public.order_lines;
DROP POLICY IF EXISTS "Vendors read own order lines" ON public.order_lines;
DROP POLICY IF EXISTS "Customers read own order lines safe" ON public.order_lines;

CREATE POLICY "Admins read all order lines"
ON public.order_lines FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendors read own order lines"
ON public.order_lines FOR SELECT TO authenticated
USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Customers read own order lines safe"
ON public.order_lines FOR SELECT TO authenticated
USING (
  order_id IN (
    SELECT id FROM public.orders WHERE customer_id IN (
      SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
    )
  )
);

-- Create customer-facing view without cost/margin columns
CREATE OR REPLACE VIEW public.customer_order_lines WITH (security_invoker = true) AS
SELECT
  id, order_id, product_id, offer_id, vendor_id,
  quantity, unit_price_excl_vat, unit_price_incl_vat,
  line_total_excl_vat, line_total_incl_vat, vat_rate,
  fulfillment_status, fulfillment_type,
  tracking_number, tracking_url,
  qogita_order_status
FROM public.order_lines;
