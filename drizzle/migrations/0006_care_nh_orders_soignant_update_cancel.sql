-- LOT 0006 — RLS nh_orders : le soignant peut modifier et annuler SES commandes
-- tant qu'elles ne sont pas parties en traitement.
-- Les policies existantes (view / create / admin_mr update / super admin) restent inchangées.

DROP POLICY IF EXISTS "NH soignants can update own orders" ON public.nh_orders;
CREATE POLICY "NH soignants can update own orders"
ON public.nh_orders
FOR UPDATE
TO authenticated
USING (
  ordered_by = auth.uid()
  AND public.has_nh_role(auth.uid(), nursing_home_id, 'soignant')
  AND status IN ('draft', 'pending')
)
WITH CHECK (
  ordered_by = auth.uid()
  AND public.has_nh_role(auth.uid(), nursing_home_id, 'soignant')
  AND status IN ('draft', 'pending', 'cancelled')
);