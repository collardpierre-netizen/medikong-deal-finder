DROP POLICY IF EXISTS "Anyone can view delegate assignments" ON public.delegate_assignments;
CREATE POLICY "Authenticated can view delegate assignments"
ON public.delegate_assignments
FOR SELECT
TO authenticated
USING (true);
REVOKE SELECT ON public.delegate_assignments FROM anon;