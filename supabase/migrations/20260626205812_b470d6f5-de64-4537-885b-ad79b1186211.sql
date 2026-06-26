-- Make SELECT restrictions on delegate tables explicit (currently covered by FOR ALL policies; add FOR SELECT policies to make the lockdown obvious to scanners and future maintainers).

-- delegates: admin-only direct read (public listing happens via SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "Delegates select admin only" ON public.delegates;
CREATE POLICY "Delegates select admin only"
  ON public.delegates
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- vendor_delegates: admin or owning vendor only (public listing happens via list_vendor_delegates_public RPC)
DROP POLICY IF EXISTS "Vendor delegates select owner or admin" ON public.vendor_delegates;
CREATE POLICY "Vendor delegates select owner or admin"
  ON public.vendor_delegates
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_delegates.vendor_id
        AND v.auth_user_id = auth.uid()
    )
  );

-- Revoke any anon access just to be safe
REVOKE SELECT ON public.delegates FROM anon;
REVOKE SELECT ON public.vendor_delegates FROM anon;