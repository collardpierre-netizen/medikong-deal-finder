DROP POLICY IF EXISTS profiles_admins_update ON public.profiles;
CREATE POLICY profiles_admins_update ON public.profiles
  FOR UPDATE
  USING (is_account_admin('buyer'::text, id))
  WITH CHECK (is_account_admin('buyer'::text, id));

DROP POLICY IF EXISTS vendors_admins_update ON public.vendors;
CREATE POLICY vendors_admins_update ON public.vendors
  FOR UPDATE
  USING (is_account_admin('vendor'::text, id))
  WITH CHECK (is_account_admin('vendor'::text, id));

DROP POLICY IF EXISTS members_admin_modify ON public.account_memberships;
CREATE POLICY members_admin_modify ON public.account_memberships
  FOR UPDATE
  USING (is_account_admin(account_kind, account_id) OR is_admin(auth.uid()))
  WITH CHECK (is_account_admin(account_kind, account_id) OR is_admin(auth.uid()));