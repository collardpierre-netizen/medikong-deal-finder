-- 1) delegates: restrict public SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view visible delegates" ON public.delegates;
CREATE POLICY "Authenticated can view visible delegates"
  ON public.delegates
  FOR SELECT
  TO authenticated
  USING (is_visible = true);

-- Defense-in-depth: revoke phone/email from anon explicitly (no-op if no grant)
REVOKE SELECT (phone, email) ON public.delegates FROM anon;

-- 2) offer_price_tiers: hide cost/margin columns from buyers and anon
REVOKE SELECT (margin_amount, qogita_unit_price) ON public.offer_price_tiers FROM authenticated;
REVOKE SELECT (margin_amount, qogita_unit_price) ON public.offer_price_tiers FROM anon;
-- Admins use SECURITY DEFINER / service_role paths (policy "Admins manage offer_price_tiers" + service_role) which bypass column grants.

-- 3) vendor_exclusivities: hide confidential contract fields from anon
REVOKE SELECT (
  contract_ref,
  reason,
  conditions_notes,
  min_revenue_cents,
  min_volume_units,
  commitment_months,
  buyer_profile_ids
) ON public.vendor_exclusivities FROM anon;
