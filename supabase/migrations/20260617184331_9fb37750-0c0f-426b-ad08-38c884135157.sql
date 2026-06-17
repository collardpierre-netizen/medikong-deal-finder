
DROP POLICY IF EXISTS "Authenticated can view visible delegates" ON public.delegates;

CREATE POLICY "Verified buyers or admins view visible delegates"
ON public.delegates
FOR SELECT
TO authenticated
USING (
  is_visible = true
  AND (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.auth_user_id = auth.uid()
        AND c.is_verified = true
    )
    OR public.is_admin(auth.uid())
  )
);

REVOKE SELECT (access_token) ON public.restock_buyers FROM authenticated;
REVOKE SELECT (access_token) ON public.restock_buyers FROM anon;
REVOKE INSERT (access_token), UPDATE (access_token) ON public.restock_buyers FROM authenticated;
REVOKE INSERT (access_token), UPDATE (access_token) ON public.restock_buyers FROM anon;
