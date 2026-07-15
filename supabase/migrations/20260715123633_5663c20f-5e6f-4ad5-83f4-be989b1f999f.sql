-- Tighten self-insert on public.customers so buyers cannot self-grant verified status,
-- credit limit or payment terms at signup. Admin insert path (Admins manage customers)
-- keeps full control via its own permissive policy.
DROP POLICY IF EXISTS "Customers insert own" ON public.customers;

CREATE POLICY "Customers insert own"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  auth_user_id = auth.uid()
  AND COALESCE(is_verified, false) = false
  AND COALESCE(credit_limit, 0) = 0
  AND COALESCE(payment_terms_days, 0) = 0
);