-- Allow authenticated users to self-register as ReStock buyer (own row, status pending)
CREATE POLICY "Users can self-insert their own restock_buyer row"
  ON public.restock_buyers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = auth_user_id
    AND verified_status = 'pending'
  );