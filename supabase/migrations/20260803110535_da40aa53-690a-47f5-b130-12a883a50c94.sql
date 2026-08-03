-- 1. Full-column private view for admins and owning vendors
DROP VIEW IF EXISTS public.offers_private;
CREATE VIEW public.offers_private WITH (security_invoker = true) AS
  SELECT o.*
  FROM public.offers o
  WHERE public.is_admin(auth.uid())
     OR EXISTS (
       SELECT 1 FROM public.vendors v
       WHERE v.id = o.vendor_id AND v.auth_user_id = auth.uid()
     );

GRANT SELECT ON public.offers_private TO authenticated;
GRANT SELECT ON public.offers_private TO service_role;

-- 2. Remove blanket table-level SELECT: authenticated keeps only the
--    column-level grants already in place for public display columns.
REVOKE SELECT ON public.offers FROM authenticated;
REVOKE SELECT ON public.offers FROM anon;

-- 3. restock_drops: hide draft/scheduled campaigns from the public
DROP POLICY IF EXISTS "Anyone can read active drops" ON public.restock_drops;
CREATE POLICY "Anyone can read published drops"
  ON public.restock_drops
  FOR SELECT
  USING (status IN ('active', 'ended'));