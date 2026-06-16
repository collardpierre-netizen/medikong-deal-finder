
DROP POLICY IF EXISTS known_suppliers_read_all ON public.known_suppliers;
CREATE POLICY known_suppliers_read_admin
  ON public.known_suppliers
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS wholesaler_profiles_read_all ON public.wholesaler_profiles;
CREATE POLICY wholesaler_profiles_read_admin
  ON public.wholesaler_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
