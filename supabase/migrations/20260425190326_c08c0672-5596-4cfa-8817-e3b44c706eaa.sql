DROP FUNCTION IF EXISTS public.get_vendor_market_intelligence(uuid);

CREATE OR REPLACE FUNCTION public.get_vendor_market_intelligence(_vendor_id uuid)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  product_image text,
  gtin text,
  cnk_code text,
  brand_name text,
  country_code text,
  my_offer_id uuid,
  my_price_excl_vat numeric,
  my_stock integer,
  my_rank integer,
  medikong_competitors_count integer,
  medikong_total_offers integer,
  best_medikong_competitor_price numeric,
  best_medikong_competitor_vendor text,
  medikong_median_price numeric,
  gap_vs_best_amount numeric,
  gap_vs_best_percentage numeric,
  gap_vs_median_amount numeric,
  gap_vs_median_percentage numeric,
  external_sources_count integer,
  best_external_price numeric,
  best_external_source text,
  medikong_offers jsonb,
  external_offers jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH my_offers AS (
    SELECT o.id AS offer_id, o.product_id, o.country_code, o.price_excl_vat, o.stock_quantity
    FROM offers o
    WHERE o.vendor_id = _vendor_id
      AND o.is_active = true
      AND o.price_excl_vat IS NOT NULL
      AND o.price_excl_vat > 0
  ),
  mk_offers_agg AS (
    SELECT
      m.product_id,
      m.country_code,
      m.offer_id AS my_offer_id,
      m.price_excl_vat AS my_price,
      m.stock_quantity AS my_stock,
      COUNT(*) FILTER (WHERE o.vendor_id <> _vendor_id) AS competitors_count,
      COUNT(*) AS total_offers,
      MIN(o.price_excl_vat) FILTER (WHERE o.vendor_id <> _vendor_id) AS best_competitor_price,
      MIN(o.price_excl_vat) AS best_overall_price,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.price_excl_vat) AS median_price,
      (
        SELECT COUNT(*) + 1 FROM offers o2
        WHERE o2.product_id = m.product_id
          AND o2.country_code = m.country_code
          AND o2.is_active = true
          AND o2.price_excl_vat IS NOT NULL
          AND o2.price_excl_vat > 0
          AND o2.price_excl_vat < m.price_excl_vat
      ) AS my_rank,
      jsonb_agg(
        jsonb_build_object(
          'offer_id', o.id,
          'vendor_id', o.vendor_id,
          'vendor_name', COALESCE(v.company_name, v.name, '—'),
          'price_excl_vat', o.price_excl_vat,
          'stock_quantity', o.stock_quantity,
          'delivery_days', o.delivery_days,
          'is_mine', (o.vendor_id = _vendor_id)
        )
        ORDER BY o.price_excl_vat ASC
      ) FILTER (WHERE o.id IS NOT NULL) AS medikong_offers
    FROM my_offers m
    JOIN offers o
      ON o.product_id = m.product_id
     AND o.country_code = m.country_code
     AND o.is_active = true
     AND o.price_excl_vat IS NOT NULL
     AND o.price_excl_vat > 0
    LEFT JOIN vendors v ON v.id = o.vendor_id
    GROUP BY m.product_id, m.country_code, m.offer_id, m.price_excl_vat, m.stock_quantity
  ),
  best_competitor_vendor AS (
    SELECT
      a.product_id,
      a.country_code,
      (
        SELECT COALESCE(v.company_name, v.name, '—')
        FROM offers o
        LEFT JOIN vendors v ON v.id = o.vendor_id
        WHERE o.product_id = a.product_id
          AND o.country_code = a.country_code
          AND o.is_active = true
          AND o.vendor_id <> _vendor_id
          AND o.price_excl_vat IS NOT NULL
        ORDER BY o.price_excl_vat ASC
        LIMIT 1
      ) AS vendor_name
    FROM mk_offers_agg a
  ),
  external_agg AS (
    SELECT
      mp.product_id,
      COUNT(DISTINCT mp.source_id)::integer AS sources_count,
      MIN(LEAST(
        COALESCE(mp.prix_pharmacien, 999999),
        COALESCE(mp.prix_grossiste, 999999),
        COALESCE(mp.prix_public, 999999)
      )) FILTER (
        WHERE COALESCE(mp.prix_pharmacien, mp.prix_grossiste, mp.prix_public) IS NOT NULL
      ) AS best_external,
      jsonb_agg(
        jsonb_build_object(
          'source_id', mp.source_id,
          'source_name', COALESCE(ms.name, mp.supplier_name, 'Source externe'),
          'prix_pharmacien', mp.prix_pharmacien,
          'prix_grossiste', mp.prix_grossiste,
          'prix_public', mp.prix_public,
          'tva_rate', mp.tva_rate,
          'product_url', mp.product_url,
          'imported_at', mp.imported_at
        )
        ORDER BY LEAST(
          COALESCE(mp.prix_pharmacien, 999999),
          COALESCE(mp.prix_grossiste, 999999),
          COALESCE(mp.prix_public, 999999)
        ) ASC
      ) AS external_offers
    FROM market_prices mp
    LEFT JOIN market_price_sources ms ON ms.id = mp.source_id
    WHERE mp.product_id IS NOT NULL
      AND mp.is_matched = true
      AND mp.product_id IN (SELECT product_id FROM my_offers)
    GROUP BY mp.product_id
  ),
  best_external_source AS (
    SELECT
      e.product_id,
      (
        SELECT COALESCE(ms.name, mp.supplier_name, 'Source externe')
        FROM market_prices mp
        LEFT JOIN market_price_sources ms ON ms.id = mp.source_id
        WHERE mp.product_id = e.product_id
          AND mp.is_matched = true
        ORDER BY LEAST(
          COALESCE(mp.prix_pharmacien, 999999),
          COALESCE(mp.prix_grossiste, 999999),
          COALESCE(mp.prix_public, 999999)
        ) ASC
        LIMIT 1
      ) AS source_name
    FROM external_agg e
  )
  SELECT
    a.product_id,
    p.name AS product_name,
    COALESCE(p.image_url, (p.image_urls)[1]) AS product_image,
    p.gtin,
    p.cnk_code,
    p.brand_name,
    a.country_code,
    a.my_offer_id,
    a.my_price AS my_price_excl_vat,
    a.my_stock AS my_stock,
    a.my_rank::integer,
    a.competitors_count::integer AS medikong_competitors_count,
    a.total_offers::integer AS medikong_total_offers,
    a.best_competitor_price AS best_medikong_competitor_price,
    bcv.vendor_name AS best_medikong_competitor_vendor,
    ROUND(a.median_price::numeric, 2) AS medikong_median_price,
    ROUND((a.my_price - a.best_overall_price)::numeric, 2) AS gap_vs_best_amount,
    CASE
      WHEN a.best_overall_price > 0
        THEN ROUND(((a.my_price - a.best_overall_price) / a.best_overall_price * 100)::numeric, 1)
      ELSE 0
    END AS gap_vs_best_percentage,
    ROUND((a.my_price - a.median_price)::numeric, 2) AS gap_vs_median_amount,
    CASE
      WHEN a.median_price > 0
        THEN ROUND(((a.my_price - a.median_price) / a.median_price * 100)::numeric, 1)
      ELSE 0
    END AS gap_vs_median_percentage,
    COALESCE(e.sources_count, 0) AS external_sources_count,
    e.best_external AS best_external_price,
    bes.source_name AS best_external_source,
    a.medikong_offers,
    COALESCE(e.external_offers, '[]'::jsonb) AS external_offers
  FROM mk_offers_agg a
  JOIN products p ON p.id = a.product_id
  LEFT JOIN best_competitor_vendor bcv ON bcv.product_id = a.product_id AND bcv.country_code = a.country_code
  LEFT JOIN external_agg e ON e.product_id = a.product_id
  LEFT JOIN best_external_source bes ON bes.product_id = a.product_id
  ORDER BY p.name;
$function$;