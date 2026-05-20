-- Self-signup vendor: autorise un utilisateur authentifié à créer SA propre fiche vendeur,
-- inactive et non approuvée. La validation reste manuelle côté admin.
CREATE POLICY "Vendors self-signup (controlled)"
ON public.vendors
FOR INSERT
TO authenticated
WITH CHECK (
  auth_user_id = auth.uid()
  AND is_active = false
  AND (validation_status IS NULL OR validation_status IS DISTINCT FROM 'approved')
);