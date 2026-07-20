
-- Fix: offers_table_public_cost_margin_exposure
-- Hide vendor cost/commission columns from anon and authenticated.
-- Owners & admins already have a SECURITY DEFINER view (offers_private) for full access.
REVOKE SELECT (
  purchase_price,
  purchase_price_excl_vat,
  qogita_base_price,
  commission_model,
  commission_rate,
  margin_split_pct,
  fixed_commission_amount,
  commission_override_status,
  commission_override_reason,
  commission_override_updated_by,
  commission_override_updated_at,
  commission_valid_from,
  commission_valid_until,
  commission_override_created_via_admin_shortcut,
  applied_margin_percentage,
  applied_margin_rule_id,
  margin_amount
) ON public.offers FROM anon, authenticated;

-- Fix: vendor_brand_authorizations_public_read
-- Hide document_reference & notes from public reads; keep authorization status public.
REVOKE SELECT (document_reference, notes) ON public.vendor_brand_authorizations FROM anon, authenticated;

-- Provide an admin-only privileged view for VBA sensitive fields
CREATE OR REPLACE VIEW public.vendor_brand_authorizations_private
WITH (security_invoker = true)
AS
SELECT *
FROM public.vendor_brand_authorizations
WHERE public.is_admin()
   OR vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid());

GRANT SELECT ON public.vendor_brand_authorizations_private TO authenticated;
