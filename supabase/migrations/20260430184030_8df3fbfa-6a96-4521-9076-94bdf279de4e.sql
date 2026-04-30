ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS accepts_rfq boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_open_rfqs integer NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendors_max_open_rfqs_positive'
  ) THEN
    ALTER TABLE public.vendors
      ADD CONSTRAINT vendors_max_open_rfqs_positive
      CHECK (max_open_rfqs IS NULL OR max_open_rfqs > 0) NOT VALID;
  END IF;
END$$;

COMMENT ON COLUMN public.vendors.accepts_rfq IS
  'Opt-in du vendeur pour recevoir des sollicitations RFQ. Défaut true.';
COMMENT ON COLUMN public.vendors.max_open_rfqs IS
  'Plafond optionnel de RFQ ouvertes simultanées (statuts dispatched/reminded/viewed/pending_review). NULL = pas de limite.';

CREATE INDEX IF NOT EXISTS idx_vendors_accepts_rfq ON public.vendors(accepts_rfq) WHERE accepts_rfq = true;

-- Helper : nombre de RFQ ouvertes par vendeur (utilise rfq_dispatch_log.status)
CREATE OR REPLACE FUNCTION public.rfq_vendor_open_count(_vendor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int
  FROM public.rfq_dispatch_log
  WHERE vendor_id = _vendor_id
    AND status::text IN ('dispatched','reminded','viewed','pending_review');
$$;

CREATE OR REPLACE FUNCTION public.rfq_resolve_target_vendors(_rfq_id uuid)
RETURNS TABLE(vendor_id uuid, reason public.rfq_target_reason)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rfq record;
  _category_id uuid;
  _buyer_country text;
  _currency text;
  _qty numeric;
BEGIN
  SELECT id, product_id, brand_id, destination_country_code, currency_code, quantity
  INTO _rfq
  FROM public.rfqs
  WHERE id = _rfq_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  _buyer_country := COALESCE(_rfq.destination_country_code, 'BE');
  _currency := COALESCE(_rfq.currency_code, 'EUR');
  _qty := COALESCE(_rfq.quantity, 1);

  SELECT p.category_id INTO _category_id
  FROM public.products p
  WHERE p.id = _rfq.product_id;

  RETURN QUERY
  WITH eligible_countries AS (
    SELECT country_code FROM public.rfq_eligible_vendor_countries(_buyer_country)
  ),
  brand_id_resolved AS (
    SELECT COALESCE(_rfq.brand_id, p.brand_id) AS brand_id, p.manufacturer_id
    FROM public.products p WHERE p.id = _rfq.product_id
    UNION ALL
    SELECT _rfq.brand_id, NULL::uuid
    WHERE _rfq.product_id IS NULL AND _rfq.brand_id IS NOT NULL
  ),
  product_vendors AS (
    SELECT DISTINCT o.vendor_id, 'product_offer'::public.rfq_target_reason AS reason
    FROM public.offers o
    WHERE _rfq.product_id IS NOT NULL
      AND o.product_id = _rfq.product_id
      AND o.is_active = true
      AND (o.stock_quantity IS NULL OR o.stock_quantity >= _qty)
      AND (o.moq IS NULL OR o.moq <= _qty)
  ),
  brand_interests AS (
    SELECT DISTINCT vci.vendor_id, 'brand_interest'::public.rfq_target_reason AS reason
    FROM public.vendor_catalog_interests vci
    JOIN brand_id_resolved b ON b.brand_id IS NOT NULL AND vci.brand_id = b.brand_id
    WHERE vci.brand_id IS NOT NULL
  ),
  manufacturer_interests AS (
    SELECT DISTINCT vci.vendor_id, 'manufacturer_interest'::public.rfq_target_reason AS reason
    FROM public.vendor_catalog_interests vci
    JOIN brand_id_resolved b ON b.manufacturer_id IS NOT NULL AND vci.manufacturer_id = b.manufacturer_id
    WHERE vci.manufacturer_id IS NOT NULL
  ),
  product_interests AS (
    SELECT DISTINCT vci.vendor_id, 'product_interest'::public.rfq_target_reason AS reason
    FROM public.vendor_catalog_interests vci
    WHERE _rfq.product_id IS NOT NULL AND vci.product_id = _rfq.product_id
  ),
  category_interests AS (
    SELECT DISTINCT vci.vendor_id, 'category_interest'::public.rfq_target_reason AS reason
    FROM public.vendor_catalog_interests vci
    WHERE _category_id IS NOT NULL AND vci.category_id = _category_id
  ),
  unioned AS (
    SELECT * FROM product_vendors
    UNION ALL SELECT * FROM brand_interests
    UNION ALL SELECT * FROM manufacturer_interests
    UNION ALL SELECT * FROM product_interests
    UNION ALL SELECT * FROM category_interests
  ),
  ranked AS (
    SELECT u.vendor_id, u.reason,
      ROW_NUMBER() OVER (
        PARTITION BY u.vendor_id
        ORDER BY CASE u.reason
          WHEN 'product_offer' THEN 1
          WHEN 'product_interest' THEN 2
          WHEN 'brand_interest' THEN 3
          WHEN 'manufacturer_interest' THEN 4
          WHEN 'category_interest' THEN 5
          ELSE 6 END
      ) AS rn
    FROM unioned u
    JOIN public.vendors v ON v.id = u.vendor_id
    WHERE COALESCE(v.is_active, true) = true
      AND v.validation_status::text IN ('accepted','approved')
      AND COALESCE(v.accepts_rfq, true) = true
      AND (
        v.accepted_currencies IS NULL
        OR array_length(v.accepted_currencies, 1) IS NULL
        OR _currency = ANY(v.accepted_currencies)
      )
      AND (
        (array_length(v.ships_to_countries, 1) IS NOT NULL
          AND _buyer_country = ANY(v.ships_to_countries))
        OR (
          (v.ships_to_countries IS NULL OR array_length(v.ships_to_countries, 1) IS NULL)
          AND (
            v.country_code IS NULL
            OR v.country_code IN (SELECT country_code FROM eligible_countries)
          )
        )
      )
      AND (
        v.max_open_rfqs IS NULL
        OR public.rfq_vendor_open_count(v.id) < v.max_open_rfqs
      )
  )
  SELECT r.vendor_id, r.reason FROM ranked r WHERE r.rn = 1;
END;
$function$;
