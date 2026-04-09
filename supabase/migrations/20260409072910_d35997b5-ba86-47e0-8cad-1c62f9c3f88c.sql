
-- 4. price_alert_vendors: remove from realtime (use DO block to handle if not present)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.price_alert_vendors;
EXCEPTION WHEN undefined_object OR undefined_table THEN
  NULL;
END $$;

-- 5. email-assets: restrict upload to admins
DROP POLICY IF EXISTS "Admin upload access for email assets" ON storage.objects;
CREATE POLICY "Admin upload email assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-assets' AND public.is_admin(auth.uid()));

-- 6. external_leads: ensure admin-only SELECT
DROP POLICY IF EXISTS "external_leads_read" ON public.external_leads;
DROP POLICY IF EXISTS "Admins read external_leads" ON public.external_leads;
CREATE POLICY "Admins read external_leads" ON public.external_leads
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- 7. restock_ratings: remove permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create ratings" ON public.restock_ratings;
