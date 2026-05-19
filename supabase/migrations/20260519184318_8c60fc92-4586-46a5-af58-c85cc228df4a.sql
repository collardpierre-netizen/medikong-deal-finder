-- Phase 1 étape 1 : verrouiller display_code comme identifiant public opaque
-- et exposer un helper RPC pour résoudre un vendeur par son code public.

-- 1) Verrouillage de la colonne (déjà 100% renseignée et unique en data)
ALTER TABLE public.vendors
  ALTER COLUMN display_code SET NOT NULL;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_display_code_key UNIQUE (display_code);

-- Index btree explicite (UNIQUE en crée déjà un, mais on garde un nom stable
-- pour les lookups côté RPC / route publique /vendeur/:code)
CREATE INDEX IF NOT EXISTS vendors_display_code_idx
  ON public.vendors (display_code);

-- 2) Helper RPC : résout un vendeur par son display_code public.
--    Retourne uniquement les champs sûrs / anonymisés (jamais name/company_name
--    en clair côté front -> garde-fou anonymity).
--    SECURITY DEFINER + search_path verrouillé.
CREATE OR REPLACE FUNCTION public.resolve_vendor_by_public_code(_code text)
RETURNS TABLE (
  id uuid,
  display_code varchar,
  country_code text,
  created_at timestamptz,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id,
         v.display_code,
         v.country_code,
         v.created_at,
         v.is_active
  FROM public.vendors v
  WHERE v.display_code = upper(trim(_code))
    AND v.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_vendor_by_public_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_vendor_by_public_code(text) TO anon, authenticated;

COMMENT ON FUNCTION public.resolve_vendor_by_public_code(text) IS
  'Résout un vendeur via son display_code public opaque (route /vendeur/:code). Retourne uniquement des champs anonymisés.';
