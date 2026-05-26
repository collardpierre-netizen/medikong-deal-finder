
-- ============================================================
-- VENDOR EXCLUSIVITIES — Lot 1a (schema + engine)
-- ============================================================

-- Enums
CREATE TYPE public.vendor_exclusivity_scope AS ENUM ('brand','manufacturer','product','category');
CREATE TYPE public.vendor_exclusivity_mode  AS ENUM ('showcase','hide','block');

-- Main table
CREATE TABLE public.vendor_exclusivities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  scope           public.vendor_exclusivity_scope NOT NULL,
  brand_id        uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES public.products(id) ON DELETE CASCADE,
  category_id     uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  mode            public.vendor_exclusivity_mode NOT NULL,
  valid_from      timestamptz NOT NULL,
  valid_until     timestamptz NOT NULL,
  country_codes   text[],
  reason          text,
  contract_ref    text,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_excl_dates_chk CHECK (valid_until > valid_from),
  CONSTRAINT vendor_excl_target_chk CHECK (
    (scope='brand'        AND brand_id        IS NOT NULL AND manufacturer_id IS NULL AND product_id IS NULL AND category_id IS NULL) OR
    (scope='manufacturer' AND manufacturer_id IS NOT NULL AND brand_id        IS NULL AND product_id IS NULL AND category_id IS NULL) OR
    (scope='product'      AND product_id      IS NOT NULL AND brand_id        IS NULL AND manufacturer_id IS NULL AND category_id IS NULL) OR
    (scope='category'     AND category_id     IS NOT NULL AND brand_id        IS NULL AND manufacturer_id IS NULL AND product_id IS NULL)
  )
);

CREATE INDEX idx_vendor_excl_brand    ON public.vendor_exclusivities(brand_id)        WHERE brand_id        IS NOT NULL;
CREATE INDEX idx_vendor_excl_mfr      ON public.vendor_exclusivities(manufacturer_id) WHERE manufacturer_id IS NOT NULL;
CREATE INDEX idx_vendor_excl_product  ON public.vendor_exclusivities(product_id)      WHERE product_id      IS NOT NULL;
CREATE INDEX idx_vendor_excl_category ON public.vendor_exclusivities(category_id)     WHERE category_id     IS NOT NULL;
CREATE INDEX idx_vendor_excl_vendor   ON public.vendor_exclusivities(vendor_id);
CREATE INDEX idx_vendor_excl_active   ON public.vendor_exclusivities(valid_until)     WHERE is_active = true;

-- Trigger: updated_at
CREATE TRIGGER trg_vendor_exclusivities_updated_at
BEFORE UPDATE ON public.vendor_exclusivities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Trigger: enforce no overlapping active exclusivity for same (scope,target,country)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_vendor_exclusivity_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _target_id uuid;
  _conflict_id uuid;
BEGIN
  IF NOT NEW.is_active THEN RETURN NEW; END IF;

  _target_id := COALESCE(NEW.brand_id, NEW.manufacturer_id, NEW.product_id, NEW.category_id);

  SELECT id INTO _conflict_id
  FROM public.vendor_exclusivities e
  WHERE e.id <> NEW.id
    AND e.is_active = true
    AND e.scope = NEW.scope
    AND COALESCE(e.brand_id, e.manufacturer_id, e.product_id, e.category_id) = _target_id
    AND tstzrange(e.valid_from, e.valid_until, '[)') && tstzrange(NEW.valid_from, NEW.valid_until, '[)')
    AND (
      e.country_codes IS NULL OR NEW.country_codes IS NULL
      OR e.country_codes && NEW.country_codes
    )
  LIMIT 1;

  IF _conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Exclusivity conflict: another active exclusivity (%) already covers this scope/target/period/country', _conflict_id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_vendor_exclusivity_overlap
BEFORE INSERT OR UPDATE ON public.vendor_exclusivities
FOR EACH ROW EXECUTE FUNCTION public.check_vendor_exclusivity_overlap();

-- ============================================================
-- RPC: resolve_offer_exclusivity(product_id, country)
-- Returns the most specific active exclusivity covering the product+country, or NULL row.
-- Cascade priority: product > brand > manufacturer > category.
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_offer_exclusivity(_product_id uuid, _country text)
RETURNS TABLE(
  exclusivity_id uuid,
  vendor_id      uuid,
  scope          public.vendor_exclusivity_scope,
  mode           public.vendor_exclusivity_mode,
  valid_until    timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH p AS (
    SELECT id, brand_id, manufacturer_id, primary_category_id
    FROM public.products WHERE id = _product_id
  ),
  candidates AS (
    SELECT e.id, e.vendor_id, e.scope, e.mode, e.valid_until,
           CASE e.scope
             WHEN 'product'      THEN 4
             WHEN 'brand'        THEN 3
             WHEN 'manufacturer' THEN 2
             WHEN 'category'     THEN 1
           END AS specificity
    FROM public.vendor_exclusivities e, p
    WHERE e.is_active = true
      AND now() >= e.valid_from
      AND now() <  e.valid_until
      AND (e.country_codes IS NULL OR _country IS NULL OR _country = ANY(e.country_codes))
      AND (
        (e.scope='product'      AND e.product_id      = p.id)
        OR (e.scope='brand'        AND e.brand_id        = p.brand_id)
        OR (e.scope='manufacturer' AND e.manufacturer_id = p.manufacturer_id)
        OR (e.scope='category'     AND e.category_id     = p.primary_category_id)
      )
  )
  SELECT id, vendor_id, scope, mode, valid_until
  FROM candidates
  ORDER BY specificity DESC, valid_until DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_offer_exclusivity(uuid, text) TO anon, authenticated, service_role;

-- ============================================================
-- Trigger: BLOCK mode — reject offers from other vendors
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_offers_exclusivity_block()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _excl record;
  _country text;
BEGIN
  _country := COALESCE(NEW.country_code, 'BE');
  SELECT * INTO _excl FROM public.resolve_offer_exclusivity(NEW.product_id, _country);

  IF _excl.exclusivity_id IS NOT NULL
     AND _excl.mode = 'block'
     AND _excl.vendor_id <> NEW.vendor_id THEN
    RAISE EXCEPTION 'Produit sous exclusivité (block) jusqu''au %, réservé à un autre vendeur', _excl.valid_until
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_offers_exclusivity_block
BEFORE INSERT OR UPDATE OF product_id, vendor_id, is_active ON public.offers
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION public.enforce_offers_exclusivity_block();

CREATE OR REPLACE FUNCTION public.enforce_external_offers_exclusivity_block()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _excl record;
BEGIN
  SELECT * INTO _excl FROM public.resolve_offer_exclusivity(NEW.product_id, NULL);

  IF _excl.exclusivity_id IS NOT NULL AND _excl.mode = 'block' THEN
    RAISE EXCEPTION 'Produit sous exclusivité (block) jusqu''au %, offres externes interdites', _excl.valid_until
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_external_offers_exclusivity_block
BEFORE INSERT OR UPDATE OF product_id, is_active ON public.external_offers
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION public.enforce_external_offers_exclusivity_block();

-- ============================================================
-- Cron-friendly RPC: expire stale exclusivities
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_vendor_exclusivities()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _n integer;
BEGIN
  WITH upd AS (
    UPDATE public.vendor_exclusivities
    SET is_active = false, updated_at = now()
    WHERE is_active = true AND valid_until <= now()
    RETURNING id
  )
  SELECT count(*) INTO _n FROM upd;

  IF _n > 0 THEN
    INSERT INTO public.audit_logs(action, entity_type, metadata)
    VALUES ('vendor_exclusivities.auto_expired', 'vendor_exclusivities',
            jsonb_build_object('expired_count', _n, 'at', now()));
  END IF;

  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_vendor_exclusivities() TO service_role;

-- Hourly cron
SELECT cron.schedule(
  'expire-vendor-exclusivities-hourly',
  '7 * * * *',
  $$ SELECT public.expire_vendor_exclusivities(); $$
);

-- ============================================================
-- GRANTs + RLS
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_exclusivities TO authenticated;
GRANT ALL ON public.vendor_exclusivities TO service_role;

ALTER TABLE public.vendor_exclusivities ENABLE ROW LEVEL SECURITY;

-- Admins (admin/super_admin) full access
CREATE POLICY "Admins manage vendor_exclusivities"
ON public.vendor_exclusivities
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Beneficiary vendor can read its own exclusivities
CREATE POLICY "Vendor reads own exclusivities"
ON public.vendor_exclusivities
FOR SELECT
TO authenticated
USING (vendor_id = public.current_vendor_id());

-- Public (anon + authenticated) can read active exclusivities — needed for buyer-facing badges
GRANT SELECT ON public.vendor_exclusivities TO anon;
CREATE POLICY "Public reads active exclusivities"
ON public.vendor_exclusivities
FOR SELECT
TO anon, authenticated
USING (is_active = true AND now() < valid_until);
