
-- 1) price_history → authenticated only
DROP POLICY IF EXISTS "Price history publicly readable" ON public.price_history;
CREATE POLICY "Price history readable by authenticated"
  ON public.price_history FOR SELECT TO authenticated
  USING (true);
REVOKE SELECT ON public.price_history FROM anon;

-- 2) restock_buyers → owner UPDATE policy
DROP POLICY IF EXISTS "Buyers update own record" ON public.restock_buyers;
CREATE POLICY "Buyers update own record"
  ON public.restock_buyers FOR UPDATE TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (
    auth.uid() = auth_user_id
    -- prevent self-promotion: verified_status changes are admin-only
    AND verified_status = (SELECT verified_status FROM public.restock_buyers WHERE auth_user_id = auth.uid())
  );

-- 3) restock_offers → seller must be a verified restock_buyer
DROP POLICY IF EXISTS "Sellers manage own offers" ON public.restock_offers;
CREATE POLICY "Sellers manage own offers"
  ON public.restock_offers FOR ALL TO authenticated
  USING (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1 FROM public.restock_buyers rb
      WHERE rb.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1 FROM public.restock_buyers rb
      WHERE rb.auth_user_id = auth.uid()
        AND rb.verified_status = 'verified'
    )
  );

-- 4) restock_transactions → restrict roles to authenticated
DROP POLICY IF EXISTS "Buyers see own transactions" ON public.restock_transactions;
CREATE POLICY "Buyers see own transactions"
  ON public.restock_transactions FOR SELECT TO authenticated
  USING (buyer_id IN (
    SELECT id FROM public.restock_buyers WHERE auth_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins manage transactions" ON public.restock_transactions;
CREATE POLICY "Admins manage transactions"
  ON public.restock_transactions FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.restock_transactions FROM anon;
