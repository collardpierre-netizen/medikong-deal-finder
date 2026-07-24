DROP POLICY IF EXISTS "Authenticated can view delegate assignments" ON public.delegate_assignments;
CREATE POLICY "Admins can view delegate assignments"
  ON public.delegate_assignments
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));