
-- 3. FIX: external_leads
DROP POLICY IF EXISTS "Admins read external_leads" ON public.external_leads;
DROP POLICY IF EXISTS "external_leads_read" ON public.external_leads;
DROP POLICY IF EXISTS "external_leads_insert" ON public.external_leads;
DROP POLICY IF EXISTS "external_leads_insert_authenticated" ON public.external_leads;
DROP POLICY IF EXISTS "Authenticated insert own leads" ON public.external_leads;

CREATE POLICY "Admins read external_leads"
  ON public.external_leads FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated insert own leads"
  ON public.external_leads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. FIX: restock_ratings - remove over-permissive insert policy
DROP POLICY IF EXISTS "Authenticated users can create ratings" ON public.restock_ratings;
