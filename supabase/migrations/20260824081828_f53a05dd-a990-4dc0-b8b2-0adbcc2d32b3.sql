CREATE POLICY "vendors_members_select"
ON public.vendors
FOR SELECT
TO authenticated
USING (id = ANY (ARRAY(SELECT public.current_user_vendor_account_ids())));