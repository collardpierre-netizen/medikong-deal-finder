-- Helper: verified buyer or admin gating
CREATE OR REPLACE FUNCTION public.is_verified_buyer_or_admin(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _uid IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = _uid AND a.is_active = true)
      OR EXISTS (SELECT 1 FROM public.customers c WHERE c.auth_user_id = _uid AND c.is_verified = true)
    )
$$;

GRANT EXECUTE ON FUNCTION public.is_verified_buyer_or_admin(uuid) TO anon, authenticated;

-- Main RPC: search discount offers
CREATE OR REPLACE FUNCTION public.search_discount_offers(
  _reference text DEFAULT 'pvp',           -- 'pvp' | 'market'
  _min_discount_pct numeric DEFAULT 30,    -- 0..99
  _brand_ids uuid[] DEFAULT NULL,
  _manufacturer_ids uuid[] DEFAULT NULL,
  _country text DEFAULT 'BE',              -- 'BE'|'FR'|'LU'|'ALL'
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
      mv.product_id,
      mv.country_code,
      mv.product_name,
      mv.cnk,
      mv.brand_id,
      mv.brand_name,
      p.manufacturer_id,
      m.name AS manufacturer_name,
      p.slug AS product_slug,
      mv.mk_best_ht,
      mv.mk_best_vendor_id,
      mv.mk_best_vendor_name,
      -- Reference price in HTVA. For PVP we have TTC → approximate HTVA using TVA cascade.
      CASE
        WHEN v_ref = 'pvp' AND mv.pvp_ttc IS NOT NULL THEN
          mv.pvp_ttc / (1 + COALESCE(public.resolve_product_vat_rate(mv.product_id), 21) / 100.0)
        WHEN v_ref = 'market' AND mv.market_public_ht IS NOT NULL THEN
          mv.market_public_ht
        WHEN v_ref = 'market' AND mv.market_pharm_ht IS NOT NULL THEN
          mv.market_pharm_ht
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
      AND mv.mk_best_ht IS NOT NULL
      AND mv.mk_best_ht > 0
      AND (_brand_ids IS NULL OR mv.brand_id = ANY(_brand_ids))
      AND (_manufacturer_ids IS NULL OR p.manufacturer_id = ANY(_manufacturer_ids))
      AND (_category_ids IS NULL OR mv.category_id = ANY(_category_ids))
  ),
  computed AS (
    SELECT
      b.*,
      CASE
        WHEN b.reference_ht IS NULL OR b.reference_ht <= 0 THEN NULL
        ELSE ROUND((1 - (b.mk_best_ht / b.reference_ht)) * 100, 2)
      END AS d_pct
    FROM base b
  ),
  filtered AS (
    SELECT *
    FROM computed
    WHERE d_pct IS NOT NULL AND d_pct >= v_min
  ),
  windowed AS (
    SELECT *, COUNT(*) OVER () AS total_cnt
    FROM filtered
    ORDER BY d_pct DESC, mk_best_ht ASC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    w.product_id,
    w.product_slug,
    w.product_name,
    w.cnk,
    w.brand_id,
    w.brand_name,
    w.manufacturer_id,
    w.manufacturer_name,
    w.mk_best_vendor_id AS vendor_id,
    w.mk_best_vendor_name AS vendor_name,
    w.country_code,
    ROUND(w.mk_best_ht * 100)::int AS best_price_htva_cents,
    ROUND(w.reference_ht * 100)::int AS reference_price_cents,
    w.ref_kind AS reference_kind,
    w.d_pct AS discount_pct,
    w.total_cnt AS total_count
  FROM windowed w;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_discount_offers(text, numeric, uuid[], uuid[], text, uuid[], int, int) TO authenticated;
