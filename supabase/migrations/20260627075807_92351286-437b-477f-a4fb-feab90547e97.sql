-- Strengthen restock_transactions INSERT policy to validate seller_id ownership
DROP POLICY IF EXISTS "Authenticated users create own transactions" ON public.restock_transactions;

CREATE POLICY "Authenticated users create own transactions"
ON public.restock_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  (
    buyer_id IS NULL
    OR buyer_id IN (SELECT id FROM public.restock_buyers WHERE auth_user_id = auth.uid())
  )
  AND (
    seller_id IS NULL
    OR seller_id = auth.uid()
    OR public.is_admin(auth.uid())
  )
);