-- Permettre à chaque utilisateur de créer / mettre à jour / supprimer sa propre
-- affectation de profil professionnel (la lecture est déjà autorisée).
-- Sans ces policies, l'upsert depuis /compte échoue silencieusement et le
-- select "Profil professionnel" semble ne pas mémoriser la sélection.

DROP POLICY IF EXISTS own_insert_assignments ON public.user_profile_assignments;
DROP POLICY IF EXISTS own_update_assignments ON public.user_profile_assignments;
DROP POLICY IF EXISTS own_delete_assignments ON public.user_profile_assignments;

CREATE POLICY own_insert_assignments
  ON public.user_profile_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY own_update_assignments
  ON public.user_profile_assignments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY own_delete_assignments
  ON public.user_profile_assignments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);