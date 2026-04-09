
-- Fix external_leads: restrict SELECT to admins only
DROP POLICY IF EXISTS "external_leads_read" ON public.external_leads;
CREATE POLICY "Admins read external_leads" ON public.external_leads
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- The old permissive public INSERT was already replaced with authenticated + user_id check
-- Verify by dropping old if exists
DROP POLICY IF EXISTS "Authenticated users can create ratings" ON public.restock_ratings;
