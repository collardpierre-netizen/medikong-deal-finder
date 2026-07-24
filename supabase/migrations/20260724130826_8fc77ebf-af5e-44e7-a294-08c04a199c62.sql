DROP POLICY IF EXISTS "Vendors read own sendcloud status row" ON public.vendor_sendcloud_credentials;

REVOKE SELECT ON public.vendor_sendcloud_credentials FROM authenticated;
GRANT ALL ON public.vendor_sendcloud_credentials TO service_role;

CREATE OR REPLACE VIEW public.vendor_sendcloud_status
WITH (security_invoker = true) AS
SELECT
  vendor_id,
  is_connected,
  last_verified_at,
  created_at
FROM public.vendor_sendcloud_credentials;

GRANT SELECT ON public.vendor_sendcloud_status TO authenticated;
GRANT ALL ON public.vendor_sendcloud_status TO service_role;

CREATE POLICY "Vendors read own sendcloud status via view"
ON public.vendor_sendcloud_credentials
FOR SELECT
TO authenticated
USING (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
);

GRANT SELECT (vendor_id, is_connected, last_verified_at, created_at)
  ON public.vendor_sendcloud_credentials TO authenticated;
