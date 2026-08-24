-- Fix finding vendor_brand_authorizations_broad_authenticated_read:
-- replace the broad authenticated read (USING true) with vendor-scoped access.
-- Admin access is already covered by the existing vba_admin_write policy (is_admin()).

DROP POLICY IF EXISTS vba_authenticated_read ON public.vendor_brand_authorizations;

CREATE POLICY vba_vendor_read
  ON public.vendor_brand_authorizations
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
    OR vendor_id IN (
      SELECT account_id
      FROM public.account_memberships
      WHERE user_id = auth.uid()
        AND account_kind = 'vendor'
        AND status = 'active'
    )
  );