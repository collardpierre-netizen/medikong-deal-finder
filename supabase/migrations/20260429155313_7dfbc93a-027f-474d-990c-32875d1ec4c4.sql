-- 1. Enum source PVP
DO $$ BEGIN
  CREATE TYPE public.pvp_source_enum AS ENUM ('apb', 'pmr', 'manufacturer', 'distributor', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Champs PVP sur products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pvp_ttc_cents integer,
  ADD COLUMN IF NOT EXISTS pvp_source public.pvp_source_enum,
  ADD COLUMN IF NOT EXISTS pvp_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pvp_country_code text DEFAULT 'BE';

ALTER TABLE public.products
  ADD CONSTRAINT products_pvp_ttc_positive CHECK (pvp_ttc_cents IS NULL OR pvp_ttc_cents > 0);

CREATE INDEX IF NOT EXISTS idx_products_pvp_country ON public.products(pvp_country_code) WHERE pvp_ttc_cents IS NOT NULL;

-- 3. Flag fabricant sur vendors
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS is_manufacturer boolean NOT NULL DEFAULT false;

-- 4. Table brand_official_distributors
CREATE TABLE IF NOT EXISTS public.brand_official_distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  validated_by uuid,
  validated_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, brand_id)
);

ALTER TABLE public.brand_official_distributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read brand distributors"
  ON public.brand_official_distributors FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage brand distributors"
  ON public.brand_official_distributors FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_brand_distributors_updated_at
  BEFORE UPDATE ON public.brand_official_distributors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_brand_distributors_vendor ON public.brand_official_distributors(vendor_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_brand_distributors_brand ON public.brand_official_distributors(brand_id) WHERE is_active = true;

-- 5. Champs PVP suggéré sur offers
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS suggested_retail_price_cents integer,
  ADD COLUMN IF NOT EXISTS suggested_retail_price_source public.pvp_source_enum;

ALTER TABLE public.offers
  ADD CONSTRAINT offers_suggested_retail_positive CHECK (suggested_retail_price_cents IS NULL OR suggested_retail_price_cents > 0);

-- 6. Fonction d'autorisation
CREATE OR REPLACE FUNCTION public.can_vendor_set_suggested_price(_vendor_id uuid, _product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = _vendor_id AND v.is_manufacturer = true
  )
  OR EXISTS (
    SELECT 1 FROM public.brand_official_distributors bod
    JOIN public.products p ON p.brand_id = bod.brand_id
    WHERE bod.vendor_id = _vendor_id
      AND p.id = _product_id
      AND bod.is_active = true
  );
$$;

-- 7. Trigger garde-fou côté offers
CREATE OR REPLACE FUNCTION public.enforce_offer_suggested_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.suggested_retail_price_cents IS NULL THEN
    NEW.suggested_retail_price_source := NULL;
    RETURN NEW;
  END IF;

  -- Service role / sync jobs bypass
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admins bypass
  IF auth.uid() IS NOT NULL AND public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NOT public.can_vendor_set_suggested_price(NEW.vendor_id, NEW.product_id) THEN
    RAISE EXCEPTION 'Vendeur non autorisé à saisir un PVP indicatif (fabricant ou distributeur officiel requis)'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.suggested_retail_price_source IS NULL THEN
    NEW.suggested_retail_price_source := 'manufacturer'::public.pvp_source_enum;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_offer_suggested_price ON public.offers;
CREATE TRIGGER trg_enforce_offer_suggested_price
  BEFORE INSERT OR UPDATE OF suggested_retail_price_cents, suggested_retail_price_source
  ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_suggested_price();

-- 8. RPC de résolution du PVP affiché
CREATE OR REPLACE FUNCTION public.resolve_product_pvp(_product_id uuid, _country_code text DEFAULT 'BE')
RETURNS TABLE (
  pvp_ttc_cents integer,
  source public.pvp_source_enum,
  source_label text,
  vendor_id uuid,
  vendor_name text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Priorité 1 : PVP officiel encodé sur le produit (APB/PMR/manuel admin)
  SELECT
    p.pvp_ttc_cents,
    p.pvp_source,
    CASE p.pvp_source
      WHEN 'apb' THEN 'Prix public APB'
      WHEN 'pmr' THEN 'Prix public PMR'
      WHEN 'manufacturer' THEN 'Prix public fabricant'
      WHEN 'distributor' THEN 'Prix public distributeur'
      ELSE 'Prix public conseillé'
    END AS source_label,
    NULL::uuid AS vendor_id,
    NULL::text AS vendor_name,
    p.pvp_updated_at AS updated_at
  FROM public.products p
  WHERE p.id = _product_id
    AND p.pvp_ttc_cents IS NOT NULL
    AND COALESCE(p.pvp_country_code, 'BE') = _country_code

  UNION ALL

  -- Priorité 2 : meilleur PVP suggéré par un vendeur autorisé
  SELECT
    o.suggested_retail_price_cents,
    o.suggested_retail_price_source,
    CASE o.suggested_retail_price_source
      WHEN 'manufacturer' THEN 'PVP suggéré fabricant : ' || COALESCE(v.company_name, v.name, '—')
      WHEN 'distributor' THEN 'PVP suggéré distributeur : ' || COALESCE(v.company_name, v.name, '—')
      ELSE 'PVP suggéré : ' || COALESCE(v.company_name, v.name, '—')
    END AS source_label,
    o.vendor_id,
    COALESCE(v.company_name, v.name, '—') AS vendor_name,
    o.updated_at
  FROM public.offers o
  JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.product_id = _product_id
    AND o.country_code = _country_code
    AND o.is_active = true
    AND o.suggested_retail_price_cents IS NOT NULL
    AND public.can_vendor_set_suggested_price(o.vendor_id, _product_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.products p2
      WHERE p2.id = _product_id AND p2.pvp_ttc_cents IS NOT NULL
        AND COALESCE(p2.pvp_country_code, 'BE') = _country_code
    )
  ORDER BY 1 ASC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_product_pvp(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_vendor_set_suggested_price(uuid, uuid) TO authenticated;