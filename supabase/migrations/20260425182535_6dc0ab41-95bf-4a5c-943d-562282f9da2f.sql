-- Function: get_vendor_competitive_position
-- Returns, for each active offer of a given vendor where there is at least one competitor,
-- the rank of the vendor's offer, total competitors count, best price and suggested target price.
CREATE OR REPLACE FUNCTION public.get_vendor_competitive_position(_vendor_id uuid)
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
  competitors_count integer,
  total_offers integer,
  my_rank integer,
  best_price_excl_vat numeric,
  best_vendor_id uuid,
  suggested_price_excl_vat numeric,
  gap_amount numeric,
  gap_percentage numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_offers AS (
    SELECT o.id AS offer_id, o.product_id, o.country_code, o.price_excl_vat, o.stock_quantity
    FROM offers o
    WHERE o.vendor_id = _vendor_id
      AND o.is_active = true
      AND o.price_excl_vat IS NOT NULL
      AND o.price_excl_vat > 0
  ),
  all_offers AS (
    SELECT o.product_id, o.country_code, o.vendor_id, o.price_excl_vat
    FROM offers o
    JOIN my_offers m
      ON m.product_id = o.product_id AND m.country_code = o.country_code
    WHERE o.is_active = true
      AND o.price_excl_vat IS NOT NULL
      AND o.price_excl_vat > 0
  ),
  agg AS (
    SELECT
      m.product_id,
      m.country_code,
      m.offer_id AS my_offer_id,
      m.price_excl_vat AS my_price,
      m.stock_quantity AS my_stock,
      COUNT(*) FILTER (WHERE a.vendor_id <> _vendor_id) AS competitors_count,
      COUNT(*) AS total_offers,
      MIN(a.price_excl_vat) AS best_price,
      (SELECT a2.vendor_id FROM all_offers a2
        WHERE a2.product_id = m.product_id AND a2.country_code = m.country_code
        ORDER BY a2.price_excl_vat ASC LIMIT 1) AS best_vendor_id,
      (
        SELECT COUNT(*) + 1 FROM all_offers a3
        WHERE a3.product_id = m.product_id
          AND a3.country_code = m.country_code
          AND a3.price_excl_vat < m.price_excl_vat
      ) AS my_rank
    FROM my_offers m
    JOIN all_offers a
      ON a.product_id = m.product_id AND a.country_code = m.country_code
    GROUP BY m.product_id, m.country_code, m.offer_id, m.price_excl_vat, m.stock_quantity
  )
  SELECT
    agg.product_id,
    p.name AS product_name,
    COALESCE(p.image_url, (p.image_urls)[1]) AS product_image,
    p.gtin,
    p.cnk_code,
    p.brand_name,
    agg.country_code,
    agg.my_offer_id,
    agg.my_price AS my_price_excl_vat,
    agg.my_stock AS my_stock,
    agg.competitors_count::integer,
    agg.total_offers::integer,
    agg.my_rank::integer,
    agg.best_price AS best_price_excl_vat,
    agg.best_vendor_id,
    -- Suggested price: 1% under best competitor (rounded to 2 decimals), only if vendor is not already #1
    CASE
      WHEN agg.my_rank > 1 THEN ROUND(agg.best_price * 0.99, 2)
      ELSE agg.my_price
    END AS suggested_price_excl_vat,
    ROUND(agg.my_price - agg.best_price, 2) AS gap_amount,
    CASE
      WHEN agg.best_price > 0 THEN ROUND((agg.my_price - agg.best_price) / agg.best_price * 100, 1)
      ELSE 0
    END AS gap_percentage
  FROM agg
  JOIN products p ON p.id = agg.product_id
  WHERE agg.competitors_count >= 1
  ORDER BY agg.my_rank DESC, agg.competitors_count DESC, p.name;
$$;