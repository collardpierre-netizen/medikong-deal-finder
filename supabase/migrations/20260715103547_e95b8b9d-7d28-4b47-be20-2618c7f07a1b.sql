
DROP POLICY IF EXISTS be_pharmacies_read_authenticated ON public.be_pharmacies;

CREATE POLICY be_pharmacies_read_trusted
ON public.be_pharmacies
FOR SELECT
TO authenticated
USING (
  public.is_verified_buyer_or_admin()
  OR EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.auth_user_id = auth.uid()
      AND v.validation_status IN ('accepted'::vendor_validation_status, 'approved'::vendor_validation_status)
  )
);

DROP POLICY IF EXISTS "Authenticated users create own transactions" ON public.restock_transactions;

CREATE POLICY "Authenticated users create own transactions"
ON public.restock_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  (
    buyer_id IS NOT NULL
    AND buyer_id IN (
      SELECT rb.id FROM public.restock_buyers rb WHERE rb.auth_user_id = auth.uid()
    )
  )
  OR (
    seller_id IS NOT NULL
    AND seller_id = auth.uid()
  )
  OR public.is_admin(auth.uid())
);
