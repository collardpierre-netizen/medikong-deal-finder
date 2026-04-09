-- Fix: tighten insert policy to require buyer_id matches current user's restock_buyers record
DROP POLICY IF EXISTS "Authenticated users create transactions" ON public.restock_transactions;
CREATE POLICY "Authenticated users create own transactions"
  ON public.restock_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_id IS NULL 
    OR buyer_id IN (SELECT id FROM restock_buyers WHERE auth_user_id = auth.uid())
  );
