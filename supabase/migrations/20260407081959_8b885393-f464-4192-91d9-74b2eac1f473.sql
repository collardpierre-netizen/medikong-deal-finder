CREATE INDEX IF NOT EXISTS idx_offers_active_product_price
ON public.offers (product_id, price_excl_vat, id)
WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.match_import_lines(_lines jsonb)
RETURNS TABLE(
  line_index integer,
  ean text,
  cnk text,
  quantity integer,
  current_price numeric,
  product_id uuid,
  product_name text,
  product_image text,
  medi_price numeric,
  offer_id uuid,
  vendor_name text,
  status text,
  saving numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH input_rows AS (
    SELECT
      COALESCE(NULLIF(r->>'index', '')::integer, 0) AS line_index,
      NULLIF(BTRIM(r->>'ean'), '') AS ean,
      NULLIF(BTRIM(r->>'cnk'), '') AS cnk,
      COALESCE(NULLIF(r->>'quantity', '')::integer, 1) AS quantity,
      COALESCE(NULLIF(r->>'currentPrice', '')::numeric, 0) AS current_price
    FROM jsonb_array_elements(_lines) AS r
  ),
  matched_products AS (
    SELECT DISTINCT ON (i.line_index)
      i.line_index,
      p.id AS product_id,
      p.name AS product_name,
      p.image_url AS product_image
    FROM input_rows i
    JOIN public.products p
      ON p.is_active = true
     AND (
       (i.ean IS NOT NULL AND p.gtin = i.ean)
       OR (i.cnk IS NOT NULL AND p.cnk_code = i.cnk)
     )
    ORDER BY
      i.line_index,
      CASE WHEN i.ean IS NOT NULL AND p.gtin = i.ean THEN 0 ELSE 1 END,
      p.id
  ),
  relevant_products AS (
    SELECT DISTINCT mp.product_id
    FROM matched_products mp
    WHERE mp.product_id IS NOT NULL
  ),
  best_offers AS (
    SELECT
      rp.product_id,
      bo.offer_id,
      bo.medi_price,
      bo.vendor_name
    FROM relevant_products rp
    LEFT JOIN LATERAL (
      SELECT
        o.id AS offer_id,
        o.price_excl_vat AS medi_price,
        v.company_name AS vendor_name
      FROM public.offers o
      LEFT JOIN public.vendors v ON v.id = o.vendor_id
      WHERE o.product_id = rp.product_id
        AND o.is_active = true
      ORDER BY o.price_excl_vat ASC, o.id
      LIMIT 1
    ) bo ON true
  )
  SELECT
    i.line_index,
    i.ean,
    i.cnk,
    i.quantity,
    i.current_price,
    mp.product_id,
    mp.product_name,
    mp.product_image,
    bo.medi_price,
    bo.offer_id,
    COALESCE(bo.vendor_name, '—') AS vendor_name,
    CASE
      WHEN mp.product_id IS NOT NULL AND bo.offer_id IS NOT NULL THEN 'found'
      ELSE 'unavailable'
    END AS status,
    CASE
      WHEN bo.medi_price IS NOT NULL AND i.current_price > bo.medi_price THEN i.current_price - bo.medi_price
      ELSE 0
    END AS saving
  FROM input_rows i
  LEFT JOIN matched_products mp ON mp.line_index = i.line_index
  LEFT JOIN best_offers bo ON bo.product_id = mp.product_id
  ORDER BY i.line_index;
$$;