
-- 1. Fix vendor-branding storage policies (replace v.name with objects.name)
DROP POLICY IF EXISTS "Vendor branding owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Vendor branding owner update" ON storage.objects;
DROP POLICY IF EXISTS "Vendor branding owner delete" ON storage.objects;

CREATE POLICY "Vendor branding owner upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vendor-branding'
    AND (
      EXISTS (SELECT 1 FROM public.vendors v
              WHERE v.auth_user_id = auth.uid()
                AND v.id::text = (storage.foldername(storage.objects.name))[1])
      OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Vendor branding owner update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'vendor-branding'
    AND (
      EXISTS (SELECT 1 FROM public.vendors v
              WHERE v.auth_user_id = auth.uid()
                AND v.id::text = (storage.foldername(storage.objects.name))[1])
      OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Vendor branding owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'vendor-branding'
    AND (
      EXISTS (SELECT 1 FROM public.vendors v
              WHERE v.auth_user_id = auth.uid()
                AND v.id::text = (storage.foldername(storage.objects.name))[1])
      OR public.is_admin(auth.uid())
    )
  );

-- 2. Fix vendor-delegates storage policies (same bug)
DROP POLICY IF EXISTS "Vendor delegates owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Vendor delegates owner update" ON storage.objects;
DROP POLICY IF EXISTS "Vendor delegates owner delete" ON storage.objects;

CREATE POLICY "Vendor delegates owner upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vendor-delegates'
    AND (
      EXISTS (SELECT 1 FROM public.vendors v
              WHERE v.auth_user_id = auth.uid()
                AND v.id::text = (storage.foldername(storage.objects.name))[1])
      OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Vendor delegates owner update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'vendor-delegates'
    AND (
      EXISTS (SELECT 1 FROM public.vendors v
              WHERE v.auth_user_id = auth.uid()
                AND v.id::text = (storage.foldername(storage.objects.name))[1])
      OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Vendor delegates owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'vendor-delegates'
    AND (
      EXISTS (SELECT 1 FROM public.vendors v
              WHERE v.auth_user_id = auth.uid()
                AND v.id::text = (storage.foldername(storage.objects.name))[1])
      OR public.is_admin(auth.uid())
    )
  );

-- 3. Admin SELECT policy for audit-pdfs bucket
CREATE POLICY "audit-pdfs admin read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'audit-pdfs' AND public.is_admin(auth.uid())
  );

-- 4. Admin SELECT policy for savings_simulations table
CREATE POLICY "Admins read savings_simulations" ON public.savings_simulations
  FOR SELECT USING (public.is_admin(auth.uid()));

-- 5. rfq-attachments: buyer entitled to view results can read storage objects
CREATE POLICY "rfq_attach_buyer_entitled_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'rfq-attachments'
    AND EXISTS (
      SELECT 1 FROM public.rfq_attachments a
      WHERE a.storage_path = storage.objects.name
        AND public.rfq_buyer_can_view_results(a.rfq_id, auth.uid())
    )
  );
