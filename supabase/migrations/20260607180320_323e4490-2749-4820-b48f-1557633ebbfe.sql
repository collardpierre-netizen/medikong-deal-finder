
-- Lot 1b — Schéma étendu vendor_exclusivities

ALTER TABLE public.vendor_exclusivities
  ADD COLUMN IF NOT EXISTS buyer_profile_ids text[] NULL,
  ADD COLUMN IF NOT EXISTS min_revenue_cents bigint NULL,
  ADD COLUMN IF NOT EXISTS min_volume_units integer NULL,
  ADD COLUMN IF NOT EXISTS commitment_months integer NULL,
  ADD COLUMN IF NOT EXISTS conditions_notes text NULL;

COMMENT ON COLUMN public.vendor_exclusivities.buyer_profile_ids IS
  'Profils acheteurs ciblés (buyer_profiles.id). NULL = tous profils.';
COMMENT ON COLUMN public.vendor_exclusivities.min_revenue_cents IS
  'CA minimum engagé sur la période (cents). Informative + future facturation.';
COMMENT ON COLUMN public.vendor_exclusivities.min_volume_units IS 'Volume minimum engagé (unités).';
COMMENT ON COLUMN public.vendor_exclusivities.commitment_months IS 'Durée d''engagement contractuelle (mois).';
COMMENT ON COLUMN public.vendor_exclusivities.conditions_notes IS 'Clause libre (markdown court).';

-- Garde-fous valeurs positives
ALTER TABLE public.vendor_exclusivities
  DROP CONSTRAINT IF EXISTS vendor_exclusivities_min_revenue_positive,
  DROP CONSTRAINT IF EXISTS vendor_exclusivities_min_volume_positive,
  DROP CONSTRAINT IF EXISTS vendor_exclusivities_commitment_positive;

ALTER TABLE public.vendor_exclusivities
  ADD CONSTRAINT vendor_exclusivities_min_revenue_positive
    CHECK (min_revenue_cents IS NULL OR min_revenue_cents >= 0),
  ADD CONSTRAINT vendor_exclusivities_min_volume_positive
    CHECK (min_volume_units IS NULL OR min_volume_units >= 0),
  ADD CONSTRAINT vendor_exclusivities_commitment_positive
    CHECK (commitment_months IS NULL OR (commitment_months > 0 AND commitment_months <= 600));

CREATE INDEX IF NOT EXISTS idx_vendor_exclusivities_buyer_profiles
  ON public.vendor_exclusivities USING GIN (buyer_profile_ids);

-- RPC : resolve_offer_exclusivity étendue (3e param _buyer_profile_id)
CREATE OR REPLACE FUNCTION public.resolve_offer_exclusivity(
  _product_id uuid,
  _country text,
  _buyer_profile_id text DEFAULT NULL
)
RETURNS TABLE(
  exclusivity_id uuid,
  vendor_id uuid,
  scope vendor_exclusivity_scope,
  mode vendor_exclusivity_mode,
  valid_until timestamp with time zone,
  applied_buyer_profile_id text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH p AS (
    SELECT id, brand_id, manufacturer_id, primary_category_id
    FROM public.products WHERE id = _product_id
  ),
  candidates AS (
    SELECT e.id, e.vendor_id, e.scope, e.mode, e.valid_until,
           e.buyer_profile_ids,
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
        e.buyer_profile_ids IS NULL
        OR (_buyer_profile_id IS NOT NULL AND _buyer_profile_id = ANY(e.buyer_profile_ids))
      )
      AND (
        (e.scope='product'      AND e.product_id      = p.id)
        OR (e.scope='brand'        AND e.brand_id        = p.brand_id)
        OR (e.scope='manufacturer' AND e.manufacturer_id = p.manufacturer_id)
        OR (e.scope='category'     AND e.category_id     = p.primary_category_id)
      )
  ),
  ranked AS (
    SELECT id, vendor_id, scope,
           -- Anonyme + exclu ciblée par profil → vitrine seulement (pas hide/block)
           CASE
             WHEN _buyer_profile_id IS NULL
              AND buyer_profile_ids IS NOT NULL
              AND mode <> 'showcase'
             THEN 'showcase'::vendor_exclusivity_mode
             ELSE mode
           END AS mode,
           valid_until,
           _buyer_profile_id AS applied_buyer_profile_id,
           specificity
    FROM candidates
  )
  SELECT id, vendor_id, scope, mode, valid_until, applied_buyer_profile_id
  FROM ranked
  ORDER BY specificity DESC, valid_until DESC
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_offer_exclusivity(uuid, text, text) TO anon, authenticated, service_role;

-- Helper : profil acheteur de l'utilisateur courant
CREATE OR REPLACE FUNCTION public.current_buyer_profile_id()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT buyer_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.current_buyer_profile_id() TO anon, authenticated, service_role;

-- Vue : exclusivités actives consommables par le Lot 3
CREATE OR REPLACE VIEW public.effective_offer_exclusivity_v
WITH (security_invoker = true) AS
SELECT
  e.id              AS exclusivity_id,
  e.vendor_id,
  e.scope,
  e.mode,
  e.product_id,
  e.brand_id,
  e.manufacturer_id,
  e.category_id,
  e.country_codes,
  e.buyer_profile_ids,
  e.valid_from,
  e.valid_until,
  e.contract_ref,
  e.commitment_months
FROM public.vendor_exclusivities e
WHERE e.is_active = true
  AND now() >= e.valid_from
  AND now() <  e.valid_until;

GRANT SELECT ON public.effective_offer_exclusivity_v TO anon, authenticated, service_role;
