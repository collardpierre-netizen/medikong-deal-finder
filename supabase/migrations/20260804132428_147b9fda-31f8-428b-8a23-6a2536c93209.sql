ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS price_needs_confirmation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_outlier_ratio numeric,
  ADD COLUMN IF NOT EXISTS price_outlier_reason text,
  ADD COLUMN IF NOT EXISTS price_confirmed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_offers_needs_confirmation
  ON public.offers (product_id) WHERE price_needs_confirmation = true;

-- Ratio plancher : une offre sous 40% de la médiane des autres offres actives
-- du même produit est considérée comme un outlier bas (risque de vente à perte).
CREATE OR REPLACE FUNCTION public.offers_low_outlier_ratio(_product_id uuid, _offer_id uuid, _base numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _base IS NULL OR _base <= 0 THEN NULL
    ELSE _base / NULLIF((
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY o.qogita_base_price)
      FROM public.offers o
      WHERE o.product_id = _product_id
        AND o.id <> COALESCE(_offer_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND o.is_active = true
        AND o.qogita_base_price IS NOT NULL
        AND o.qogita_base_price > 0
      HAVING COUNT(*) >= 2
    ), 0)
  END;
$$;

CREATE OR REPLACE FUNCTION public.offers_flag_low_outlier()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _ratio numeric;
BEGIN
  IF NEW.qogita_base_price IS NULL OR NEW.is_active = false THEN
    NEW.price_needs_confirmation := false;
    NEW.price_outlier_ratio := NULL;
    NEW.price_outlier_reason := NULL;
    RETURN NEW;
  END IF;

  _ratio := public.offers_low_outlier_ratio(NEW.product_id, NEW.id, NEW.qogita_base_price);
  NEW.price_outlier_ratio := _ratio;

  IF _ratio IS NOT NULL AND _ratio < 0.4 THEN
    -- Une confirmation API en direct reste valable 7 jours (aligné sur le seuil
    -- de fraîcheur Qogita du checkout).
    IF NEW.price_confirmed_at IS NULL OR NEW.price_confirmed_at < now() - interval '7 days' THEN
      NEW.price_needs_confirmation := true;
      NEW.price_outlier_reason := 'intra_product_low_outlier';
    ELSE
      NEW.price_needs_confirmation := false;
      NEW.price_outlier_reason := 'intra_product_low_outlier_api_confirmed';
    END IF;
  ELSE
    NEW.price_needs_confirmation := false;
    NEW.price_outlier_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offers_flag_low_outlier ON public.offers;
CREATE TRIGGER trg_offers_flag_low_outlier
  BEFORE INSERT OR UPDATE OF qogita_base_price, price_excl_vat, is_active, price_confirmed_at
  ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.offers_flag_low_outlier();

-- Balayage complet (nuit / manuel admin)
CREATE OR REPLACE FUNCTION public.flag_low_price_outliers(_product_ids uuid[] DEFAULT NULL)
RETURNS TABLE(flagged integer, cleared integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _flagged integer := 0;
  _cleared integer := 0;
BEGIN
  CREATE TEMP TABLE _lo ON COMMIT DROP AS
  WITH act AS (
    SELECT id, product_id, qogita_base_price p, price_confirmed_at
    FROM public.offers
    WHERE is_active = true
      AND qogita_base_price IS NOT NULL
      AND qogita_base_price > 0
      AND (_product_ids IS NULL OR product_id = ANY(_product_ids))
  ),
  g AS (
    SELECT product_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY p) med
    FROM act GROUP BY product_id HAVING COUNT(*) >= 3
  )
  SELECT a.id,
         a.p / g.med AS ratio,
         (a.price_confirmed_at IS NOT NULL AND a.price_confirmed_at >= now() - interval '7 days') AS confirmed
  FROM act a JOIN g USING (product_id)
  WHERE a.p < 0.4 * g.med;

  UPDATE public.offers o
  SET price_needs_confirmation = NOT l.confirmed,
      price_outlier_ratio = l.ratio,
      price_outlier_reason = CASE WHEN l.confirmed THEN 'intra_product_low_outlier_api_confirmed' ELSE 'intra_product_low_outlier' END
  FROM _lo l
  WHERE o.id = l.id
    AND (o.price_needs_confirmation IS DISTINCT FROM NOT l.confirmed
         OR o.price_outlier_ratio IS DISTINCT FROM l.ratio);
  GET DIAGNOSTICS _flagged = ROW_COUNT;

  UPDATE public.offers o
  SET price_needs_confirmation = false,
      price_outlier_ratio = NULL,
      price_outlier_reason = NULL
  WHERE o.price_needs_confirmation = true
    AND (_product_ids IS NULL OR o.product_id = ANY(_product_ids))
    AND NOT EXISTS (SELECT 1 FROM _lo l WHERE l.id = o.id);
  GET DIAGNOSTICS _cleared = ROW_COUNT;

  RETURN QUERY SELECT _flagged, _cleared;
END;
$$;

REVOKE ALL ON FUNCTION public.flag_low_price_outliers(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flag_low_price_outliers(uuid[]) TO service_role;

-- Exclusion des outliers non confirmés de la sélection "meilleure offre"
CREATE OR REPLACE FUNCTION public.get_best_offers_for_products(_product_ids uuid[], _country text, _buyer_profile_id text DEFAULT NULL::text)
 RETURNS TABLE(product_id uuid, offer_id uuid, vendor_id uuid, vendor_name text, vendor_company_name text, vendor_display_name text, vendor_display_code text, vendor_is_verified boolean, vendor_show_real_name boolean, vendor_show_real_name_resolved boolean, effective_price_excl_vat numeric, effective_price_incl_vat numeric, price_source text, delivery_days integer, stock_quantity numeric, offer_count integer, total_stock numeric, exclusivity_mode vendor_exclusivity_mode, is_exclusive_winner boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH excl AS (
    SELECT p_id AS product_id,
           r.vendor_id AS excl_vendor_id,
           r.mode      AS excl_mode
    FROM unnest(_product_ids) AS p_id
    LEFT JOIN LATERAL public.resolve_offer_exclusivity(p_id, _country, _buyer_profile_id) r ON true
  ),
  base AS (
    SELECT o.id AS offer_id,
           o.product_id,
           o.vendor_id,
           o.price_excl_vat AS base_price_excl_vat,
           o.price_incl_vat AS base_price_incl_vat,
           o.delivery_days,
           o.stock_quantity,
           e.excl_vendor_id,
           e.excl_mode
    FROM public.offers o
    JOIN excl e ON e.product_id = o.product_id
    WHERE o.product_id = ANY(_product_ids)
      AND o.is_active = true
      AND o.price_needs_confirmation = false
      AND o.country_code = _country
      AND EXISTS (SELECT 1 FROM public.vendors_public vpf WHERE vpf.id = o.vendor_id)
      AND (
        e.excl_mode IS NULL
        OR e.excl_mode = 'showcase'
        OR o.vendor_id = e.excl_vendor_id
      )
  ),
  priced AS (
    SELECT b.*,
           COALESCE(
             (SELECT v.effective_price_excl_vat FROM public.effective_offer_prices_v v
              WHERE v.offer_id = b.offer_id AND v.buyer_profile_id = COALESCE(_buyer_profile_id, '') LIMIT 1),
             b.base_price_excl_vat
           ) AS eff_excl,
           COALESCE(
             (SELECT v.effective_price_incl_vat FROM public.effective_offer_prices_v v
              WHERE v.offer_id = b.offer_id AND v.buyer_profile_id = COALESCE(_buyer_profile_id, '') LIMIT 1),
             b.base_price_incl_vat
           ) AS eff_incl,
           COALESCE(
             (SELECT v.price_source FROM public.effective_offer_prices_v v
              WHERE v.offer_id = b.offer_id AND v.buyer_profile_id = COALESCE(_buyer_profile_id, '') LIMIT 1),
             'offer_base'
           ) AS src
    FROM base b
  ),
  agg AS (
    SELECT product_id, COUNT(*)::int AS offer_count, COALESCE(SUM(stock_quantity), 0) AS total_stock
    FROM base GROUP BY product_id
  ),
  ranked AS (
    SELECT p.*,
           ROW_NUMBER() OVER (
             PARTITION BY p.product_id
             ORDER BY
               CASE WHEN p.excl_mode = 'showcase' AND p.vendor_id = p.excl_vendor_id THEN 0 ELSE 1 END,
               p.eff_excl ASC NULLS LAST,
               p.offer_id
           ) AS rn
    FROM priced p
  )
  SELECT r.product_id, r.offer_id, r.vendor_id,
         vp.name, vp.company_name, vp.display_name, vp.display_code, vp.is_verified, vp.show_real_name,
         COALESCE((
           SELECT vr.show_real_name FROM public.vendor_visibility_rules vr
           WHERE vr.vendor_id = r.vendor_id
             AND (vr.country_code IS NULL OR vr.country_code = _country)
             AND (vr.customer_type IS NULL OR vr.customer_type = COALESCE(_buyer_profile_id, ''))
           ORDER BY vr.priority DESC NULLS LAST LIMIT 1
         ), vp.show_real_name) AS vendor_show_real_name_resolved,
         r.eff_excl, r.eff_incl, r.src, r.delivery_days, r.stock_quantity,
         a.offer_count, a.total_stock,
         r.excl_mode AS exclusivity_mode,
         (r.excl_mode IS NOT NULL AND r.vendor_id = r.excl_vendor_id) AS is_exclusive_winner
  FROM ranked r
  JOIN agg a ON a.product_id = r.product_id
  JOIN public.vendors_public vp ON vp.id = r.vendor_id
  WHERE r.rn = 1;
$function$;

-- Les agrégats produit (prix affiché) ignorent aussi les outliers non confirmés
CREATE OR REPLACE FUNCTION public.update_product_aggregates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _product_id uuid;
BEGIN
  _product_id := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE products SET
    best_price_excl_vat = (SELECT MIN(price_excl_vat) FROM offers WHERE product_id = _product_id AND is_active = true AND price_needs_confirmation = false),
    best_price_incl_vat = (SELECT MIN(price_incl_vat) FROM offers WHERE product_id = _product_id AND is_active = true AND price_needs_confirmation = false),
    -- DISTINCT vendor_id : un même vendeur publie 1 offre commerciale, déclinée sur N pays.
    offer_count = (SELECT COUNT(DISTINCT vendor_id) FROM offers WHERE product_id = _product_id AND is_active = true),
    total_stock = (SELECT COALESCE(SUM(stock_quantity), 0) FROM offers WHERE product_id = _product_id AND is_active = true),
    min_delivery_days = (SELECT MIN(delivery_days) FROM offers WHERE product_id = _product_id AND is_active = true),
    is_in_stock = EXISTS(SELECT 1 FROM offers WHERE product_id = _product_id AND is_active = true AND stock_quantity > 0),
    best_bundle_size = (
      SELECT moq FROM offers
      WHERE product_id = _product_id AND is_active = true AND price_needs_confirmation = false
      ORDER BY price_excl_vat ASC NULLS LAST, moq ASC NULLS LAST
      LIMIT 1
    ),
    updated_at = now()
  WHERE id = _product_id;
  RETURN NULL;
END;
$function$;

SELECT cron.schedule(
  'flag-low-price-outliers-nightly',
  '40 2 * * *',
  $$SELECT public.flag_low_price_outliers();$$
);