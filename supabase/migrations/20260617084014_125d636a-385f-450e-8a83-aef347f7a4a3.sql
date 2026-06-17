-- MOV global de repli (admin-configurable, fallback ultime de la cascade MOV vendeur)
-- Stocké en cents (entier) sous la clé admin_settings 'global_default_mov_cents'.
-- NULL ou absent = pas de fallback (comportement actuel).
INSERT INTO public.admin_settings (key, value_json, description)
VALUES (
  'global_default_mov_cents',
  'null'::jsonb,
  'MOV global de repli (en cents, HTVA). Utilisé uniquement si aucune règle vendeur (vendor_buyer_overrides, vendor_profile_defaults, offers.mov) ne définit de MOV. Le plancher virtuel 500 EUR Qogita/Balooh s''applique toujours en sus.'
)
ON CONFLICT (key) DO NOTHING;

-- Permettre aux admins d'écrire le réglage depuis l'UI (lecture déjà gérée par admin_settings_admin_read).
DROP POLICY IF EXISTS admin_settings_admin_write ON public.admin_settings;
CREATE POLICY admin_settings_admin_write
  ON public.admin_settings
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

GRANT INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;