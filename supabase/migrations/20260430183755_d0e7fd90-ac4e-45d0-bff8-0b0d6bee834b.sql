-- 1. Vendors : devises acceptées et pays servis
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS accepted_currencies text[] NOT NULL DEFAULT ARRAY['EUR']::text[],
  ADD COLUMN IF NOT EXISTS ships_to_countries text[] NOT NULL DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.vendors.accepted_currencies IS
  'Codes ISO 4217 des devises acceptées par le vendeur pour facturer une commande RFQ. Défaut EUR.';
COMMENT ON COLUMN public.vendors.ships_to_countries IS
  'Codes pays ISO-2 explicitement servis par le vendeur. Si vide, le filtre RFQ retombe sur pays vendeur + limitrophes acheteur.';

CREATE INDEX IF NOT EXISTS idx_vendors_ships_to_countries
  ON public.vendors USING GIN (ships_to_countries);
CREATE INDEX IF NOT EXISTS idx_vendors_accepted_currencies
  ON public.vendors USING GIN (accepted_currencies);

-- 2. RFQ : devise demandée
ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'EUR';

ALTER TABLE public.rfqs
  ADD CONSTRAINT rfqs_currency_code_format
  CHECK (currency_code ~ '^[A-Z]{3}$') NOT VALID;

COMMENT ON COLUMN public.rfqs.currency_code IS
  'Devise (ISO 4217) attendue par l''acheteur pour les réponses des vendeurs. Défaut EUR.';

-- 3. Résolution des vendeurs cibles : intègre devise + pays servi explicite
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
BEGIN
  SELECT id, product_id, brand_id, destination_country_code, currency_code
  INTO _rfq
  FROM public.rfqs
  WHERE id = _rfq_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  _buyer_country := COALESCE(_rfq.destination_country_code, 'BE');
  _currency := COALESCE(_rfq.currency_code, 'EUR');

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
    WHERE _rfq.product_id IS NOT NULL AND o.product_id = _rfq.product_id AND o.is_active = true
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
      -- Filtre devise : le vendeur doit accepter la devise demandée
      AND (
        v.accepted_currencies IS NULL
        OR array_length(v.accepted_currencies, 1) IS NULL
        OR _currency = ANY(v.accepted_currencies)
      )
      -- Filtre pays :
      --   * si ships_to_countries défini → pays acheteur doit y figurer
      --   * sinon → comportement legacy (pays vendeur ∈ acheteur ou limitrophes)
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
  )
  SELECT r.vendor_id, r.reason FROM ranked r WHERE r.rn = 1;
END;
$function$;
