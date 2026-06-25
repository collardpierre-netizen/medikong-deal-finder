
-- Replace transient policy with the original seller row access; PII columns
-- are blocked at the column-grant layer below.
DROP POLICY IF EXISTS "Sellers read own transactions" ON public.restock_transactions;
CREATE POLICY "Sellers see own transactions"
  ON public.restock_transactions FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

-- Column-level REVOKE: no authenticated user (sellers, admins, buyers via
-- their own SELECT path) can read buyer_email / buyer_phone / buyer_vat_number
-- through the table API. Admins and the buyer themselves can still retrieve
-- the data via SECURITY DEFINER functions (and the service role is unaffected).
REVOKE SELECT (buyer_email, buyer_phone, buyer_vat_number)
  ON public.restock_transactions
  FROM anon, authenticated;
