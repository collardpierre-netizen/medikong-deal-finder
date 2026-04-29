
-- 1) Override TVA au niveau produit (priorité max)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS vat_rate_override numeric;

COMMENT ON COLUMN public.products.vat_rate_override IS 'Override admin du taux TVA pour ce produit (priorité max devant CNK et catégorie). NULL = pas d''override.';

-- 2) Table de mapping CNK -> taux TVA (administrable)
-- En BE : médicaments remboursables/CNK = 6%, OTC/parapharmacie = 21%.
-- L''admin peut saisir des CNK individuels OU des préfixes (ex: '0' pour tous les CNK commençant par 0).
CREATE TABLE IF NOT EXISTS public.cnk_vat_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnk_code text,             -- match exact si fourni
  cnk_prefix text,           -- match préfixe si fourni (LIKE 'prefix%')
  vat_rate numeric NOT NULL CHECK (vat_rate IN (6, 12, 21)),
  country_code text NOT NULL DEFAULT 'BE',
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cnk_code IS NOT NULL OR cnk_prefix IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_cnk_vat_mapping_code   ON public.cnk_vat_mapping (cnk_code) WHERE cnk_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cnk_vat_mapping_prefix ON public.cnk_vat_mapping (cnk_prefix) WHERE cnk_prefix IS NOT NULL;

ALTER TABLE public.cnk_vat_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone reads cnk_vat_mapping" ON public.cnk_vat_mapping;
CREATE POLICY "Everyone reads cnk_vat_mapping"
ON public.cnk_vat_mapping FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage cnk_vat_mapping" ON public.cnk_vat_mapping;
CREATE POLICY "Admins manage cnk_vat_mapping"
ON public.cnk_vat_mapping FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_cnk_vat_mapping_updated ON public.cnk_vat_mapping;
CREATE TRIGGER trg_cnk_vat_mapping_updated
BEFORE UPDATE ON public.cnk_vat_mapping
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) RPC qui résout le taux TVA effectif d'un produit
-- Priorité : override produit > mapping CNK exact > mapping CNK préfixe (le + long) > vat_rate catégorie > fallback 21
CREATE OR REPLACE FUNCTION public.resolve_product_vat_rate(_product_id uuid, _country_code text DEFAULT 'BE')
RETURNS TABLE(vat_rate numeric, source text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override numeric;
  v_cnk text;
  v_cat_rate numeric;
  v_match numeric;
  v_match_prefix text;
BEGIN
  -- 1. Override produit
  SELECT p.vat_rate_override, p.cnk_code
    INTO v_override, v_cnk
  FROM public.products p
  WHERE p.id = _product_id;

  IF v_override IS NOT NULL THEN
    RETURN QUERY SELECT v_override, 'product_override'::text;
    RETURN;
  END IF;

  -- 2. Mapping CNK exact
  IF v_cnk IS NOT NULL AND v_cnk <> '' THEN
    SELECT m.vat_rate INTO v_match
    FROM public.cnk_vat_mapping m
    WHERE m.is_active = true
      AND m.country_code = _country_code
      AND m.cnk_code = v_cnk
    LIMIT 1;
    IF v_match IS NOT NULL THEN
      RETURN QUERY SELECT v_match, 'cnk_exact'::text;
      RETURN;
    END IF;

    -- 3. Mapping CNK par préfixe (le + long gagne)
    SELECT m.vat_rate, m.cnk_prefix INTO v_match, v_match_prefix
    FROM public.cnk_vat_mapping m
    WHERE m.is_active = true
      AND m.country_code = _country_code
      AND m.cnk_prefix IS NOT NULL
      AND v_cnk LIKE m.cnk_prefix || '%'
    ORDER BY length(m.cnk_prefix) DESC
    LIMIT 1;
    IF v_match IS NOT NULL THEN
      RETURN QUERY SELECT v_match, ('cnk_prefix:' || v_match_prefix)::text;
      RETURN;
    END IF;
  END IF;

  -- 4. vat_rate de la catégorie
  SELECT c.vat_rate INTO v_cat_rate
  FROM public.products p
  JOIN public.categories c ON c.id = p.category_id
  WHERE p.id = _product_id;

  IF v_cat_rate IS NOT NULL THEN
    RETURN QUERY SELECT v_cat_rate, 'category'::text;
    RETURN;
  END IF;

  -- 5. fallback
  RETURN QUERY SELECT 21::numeric, 'fallback'::text;
END;
$$;
