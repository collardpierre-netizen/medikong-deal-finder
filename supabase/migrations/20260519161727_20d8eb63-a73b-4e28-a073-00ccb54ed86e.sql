DROP FUNCTION IF EXISTS public.search_discount_offers(text, numeric, uuid[], uuid[], text, uuid[], int, int);

CREATE OR REPLACE FUNCTION public.search_discount_offers(
  _reference text DEFAULT 'pvp',
  _min_discount_pct numeric DEFAULT 30,
  _brand_ids uuid[] DEFAULT NULL,
  _manufacturer_ids uuid[] DEFAULT NULL,
  _country text DEFAULT 'BE',
  _category_ids uuid[] DEFAULT NULL,
  _limit int DEFAULT 100,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  product_id uuid,
  product_slug text,
  product_name text,
  cnk text,
  brand_id uuid,
  brand_name text,
  manufacturer_id uuid,
  manufacturer_name text,
  vendor_id uuid,
  vendor_name text,
  country_code text,
  best_price_htva_cents integer,
  reference_price_cents integer,
  reference_kind text,
  discount_pct numeric,
  offer_id uuid,
  moq integer,
  mov_eur_cents integer,
  stock_quantity integer,
  delivery_days integer,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country text := COALESCE(NULLIF(_country, ''), 'BE');
  v_min numeric := GREATEST(COALESCE(_min_discount_pct, 0), 0);
  v_ref text := CASE WHEN COALESCE(_reference,'pvp') IN ('pvp','market') THEN _reference ELSE 'pvp' END;
  v_limit int := LEAST(GREATEST(COALESCE(_limit, 100), 1), 5000);
  v_offset int := GREATEST(COALESCE(_offset, 0), 0);
BEGIN
  IF NOT public.is_verified_buyer_or_admin() THEN
    RAISE EXCEPTION 'unauthorized: verified buyer required';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      mv.product_id, mv.country_code, mv.product_name, mv.cnk, mv.brand_id, mv.brand_name,
      p.manufacturer_id, m.name AS manufacturer_name, p.slug AS product_slug,
      mv.mk_best_ht, mv.mk_best_vendor_id, mv.mk_best_vendor_name, mv.mk_best_offer_id,
      CASE
        WHEN v_ref = 'pvp' AND mv.pvp_ttc IS NOT NULL THEN
          mv.pvp_ttc / (1 + COALESCE(public.resolve_product_vat_rate(mv.product_id), 21) / 100.0)
        WHEN v_ref = 'market' AND mv.market_public_ht IS NOT NULL THEN mv.market_public_ht
        WHEN v_ref = 'market' AND mv.market_pharm_ht IS NOT NULL THEN mv.market_pharm_ht
        ELSE NULL
      END AS reference_ht,
      CASE
        WHEN v_ref = 'pvp' THEN 'pvp'
        WHEN v_ref = 'market' AND mv.market_public_ht IS NOT NULL THEN 'market_public'
        WHEN v_ref = 'market' AND mv.market_pharm_ht IS NOT NULL THEN 'market_pharm'
        ELSE 'none'
      END AS ref_kind
    FROM public.admin_price_cockpit_mv mv
    JOIN public.products p ON p.id = mv.product_id AND p.is_active = true
    LEFT JOIN public.manufacturers m ON m.id = p.manufacturer_id
    WHERE mv.country_code = v_country
      AND mv.mk_best_ht IS NOT NULL AND mv.mk_best_ht > 0
      AND (_brand_ids IS NULL OR mv.brand_id = ANY(_brand_ids))
      AND (_manufacturer_ids IS NULL OR p.manufacturer_id = ANY(_manufacturer_ids))
      AND (_category_ids IS NULL OR mv.category_id = ANY(_category_ids))
  ),
  computed AS (
    SELECT b.*,
      CASE WHEN b.reference_ht IS NULL OR b.reference_ht <= 0 THEN NULL
           ELSE ROUND((1 - (b.mk_best_ht / b.reference_ht)) * 100, 2)
      END AS d_pct
    FROM base b
  ),
  filtered AS (
    SELECT * FROM computed WHERE d_pct IS NOT NULL AND d_pct >= v_min
  ),
  windowed AS (
    SELECT *, COUNT(*) OVER () AS total_cnt
    FROM filtered
    ORDER BY d_pct DESC, mk_best_ht ASC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    w.product_id, w.product_slug, w.product_name, w.cnk,
    w.brand_id, w.brand_name, w.manufacturer_id, w.manufacturer_name,
    w.mk_best_vendor_id, w.mk_best_vendor_name, w.country_code,
    ROUND(w.mk_best_ht * 100)::int,
    ROUND(w.reference_ht * 100)::int,
    w.ref_kind, w.d_pct,
    w.mk_best_offer_id,
    COALESCE(o.moq, 1)::int,
    ROUND(COALESCE(o.mov, o.mov_amount, 0) * 100)::int,
    COALESCE(o.stock_quantity, 0)::int,
    COALESCE(o.estimated_delivery_days, o.delivery_days)::int,
    w.total_cnt
  FROM windowed w
  LEFT JOIN public.offers o ON o.id = w.mk_best_offer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_discount_offers(text, numeric, uuid[], uuid[], text, uuid[], int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_discount_offers_by_vendor(
  _reference text DEFAULT 'pvp',
  _min_discount_pct numeric DEFAULT 30,
  _brand_ids uuid[] DEFAULT NULL,
  _manufacturer_ids uuid[] DEFAULT NULL,
  _country text DEFAULT 'BE',
  _category_ids uuid[] DEFAULT NULL,
  _max_products_per_vendor int DEFAULT 50,
  _limit int DEFAULT 50
)
RETURNS TABLE (
  vendor_id uuid,
  vendor_name text,
  product_count integer,
  max_mov_eur_cents integer,
  min_basket_at_moq_eur_cents bigint,
  total_savings_eur_cents bigint,
  avg_discount_pct numeric,
  products jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(_limit, 50), 1), 500);
  v_per int := LEAST(GREATEST(COALESCE(_max_products_per_vendor, 50), 1), 500);
BEGIN
  IF NOT public.is_verified_buyer_or_admin() THEN
    RAISE EXCEPTION 'unauthorized: verified buyer required';
  END IF;

  RETURN QUERY
  WITH raw AS (
    SELECT * FROM public.search_discount_offers(
      _reference, _min_discount_pct, _brand_ids, _manufacturer_ids, _country, _category_ids, 5000, 0
    )
  ),
  ranked AS (
    SELECT r.*,
      row_number() OVER (PARTITION BY r.vendor_id ORDER BY r.discount_pct DESC, r.best_price_htva_cents ASC) AS rn
    FROM raw r
    WHERE r.vendor_id IS NOT NULL
  ),
  capped AS (
    SELECT * FROM ranked WHERE rn <= v_per
  )
  SELECT
    c.vendor_id,
    MAX(c.vendor_name) AS vendor_name,
    COUNT(*)::int AS product_count,
    MAX(c.mov_eur_cents)::int AS max_mov_eur_cents,
    SUM(c.best_price_htva_cents::bigint * GREATEST(c.moq,1)) AS min_basket_at_moq_eur_cents,
    SUM(((c.reference_price_cents - c.best_price_htva_cents)::bigint * GREATEST(c.moq,1))) AS total_savings_eur_cents,
    ROUND(AVG(c.discount_pct), 2) AS avg_discount_pct,
    jsonb_agg(jsonb_build_object(
      'product_id', c.product_id,
      'product_slug', c.product_slug,
      'product_name', c.product_name,
      'cnk', c.cnk,
      'brand_name', c.brand_name,
      'best_price_htva_cents', c.best_price_htva_cents,
      'reference_price_cents', c.reference_price_cents,
      'discount_pct', c.discount_pct,
      'moq', c.moq,
      'stock_quantity', c.stock_quantity,
      'offer_id', c.offer_id
    ) ORDER BY c.discount_pct DESC) AS products
  FROM capped c
  GROUP BY c.vendor_id
  ORDER BY SUM(((c.reference_price_cents - c.best_price_htva_cents)::bigint * GREATEST(c.moq,1))) DESC NULLS LAST
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_discount_offers_by_vendor(text, numeric, uuid[], uuid[], text, uuid[], int, int) TO authenticated;