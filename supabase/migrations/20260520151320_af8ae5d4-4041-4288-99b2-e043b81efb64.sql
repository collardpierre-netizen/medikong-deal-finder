ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS bce_number text,
  ADD COLUMN IF NOT EXISTS representative_name text,
  ADD COLUMN IF NOT EXISTS representative_role text;

COMMENT ON COLUMN public.vendors.bce_number IS 'Numéro BCE belge (sans préfixe BE). Utilisé pour le mandat de facturation.';
COMMENT ON COLUMN public.vendors.representative_name IS 'Nom complet du représentant légal signataire des conventions.';
COMMENT ON COLUMN public.vendors.representative_role IS 'Fonction du représentant légal (ex: Gérant, Administrateur).';