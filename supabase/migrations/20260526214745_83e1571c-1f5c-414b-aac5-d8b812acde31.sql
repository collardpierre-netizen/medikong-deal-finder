
-- 1) offer_price_tiers: hide internal cost/margin from non-service-role
REVOKE SELECT (margin_amount, qogita_unit_price) ON public.offer_price_tiers FROM anon;
REVOKE SELECT (margin_amount, qogita_unit_price) ON public.offer_price_tiers FROM authenticated;

-- 2) vendors: drop the broad "readable by authenticated" policy.
-- vendors_members_select + "Admins manage vendors" remain. Public display data
-- continues to flow through the vendors_public SECURITY DEFINER view.
DROP POLICY IF EXISTS "Vendors readable by authenticated" ON public.vendors;

-- 3) admin_settings: restrict reads to admins only
DROP POLICY IF EXISTS admin_settings_read_all ON public.admin_settings;
CREATE POLICY admin_settings_admin_read
ON public.admin_settings
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- 4) restock-photos storage: INSERT must target an offer owned by the caller
-- (file path convention: "<offer_id>/<timestamp>-<i>.<ext>")
DROP POLICY IF EXISTS "Authenticated users can upload restock photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload restock photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'restock-photos'
  AND EXISTS (
    SELECT 1 FROM public.restock_offers o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.seller_id = auth.uid()
  )
);
