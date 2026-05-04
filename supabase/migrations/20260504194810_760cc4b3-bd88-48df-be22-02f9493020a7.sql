
-- 1. Materialized view
DROP MATERIALIZED VIEW IF EXISTS public.admin_price_cockpit_mv CASCADE;

CREATE MATERIALIZED VIEW public.admin_price_cockpit_mv AS
WITH all_countries AS (
  SELECT unnest(ARRAY['ALL','BE','FR','LU','NL']) AS cc
),
mk_offers AS (
  SELECT
    o.product_id,
    ac.cc AS country_code,
    o.id AS offer_id,
    o.vendor_id,
    o.price_excl_vat AS ht,
    row_number() OVER (PARTITION BY o.product_id, ac.cc ORDER BY o.price_excl_vat ASC) AS rn,
    count(*) OVER (PARTITION BY o.product_id, ac.cc) AS cnt
  FROM public.offers o
  CROSS JOIN all_countries ac
  WHERE o.is_active = true
    AND (ac.cc = 'ALL' OR o.country_code = ac.cc)
),
mk_best AS (
  SELECT product_id, country_code, offer_id, vendor_id, ht AS mk_best_ht, cnt AS mk_offers_count
  FROM mk_offers WHERE rn = 1
),
mk_2nd AS (
  SELECT product_id, country_code, ht AS mk_2nd_ht
  FROM mk_offers WHERE rn = 2
),
ext_best AS (
  SELECT
    e.product_id,
    min(e.unit_price) AS external_best_ht,
    (array_agg(ev.name ORDER BY e.unit_price ASC))[1] AS external_best_source,
    (array_agg(e.product_url ORDER BY e.unit_price ASC))[1] AS external_best_url,
    count(*)::int AS external_offers_count
  FROM public.external_offers e
  JOIN public.external_vendors ev ON ev.id = e.external_vendor_id
  WHERE e.is_active = true
  GROUP BY e.product_id
),
market_agg AS (
  SELECT
    mp.product_id,
    min(mp.prix_pharmacien) AS pharm_ht,
    min(mp.prix_grossiste) AS grossiste_ht,
    min(mp.prix_public) AS public_ht
  FROM public.market_prices mp
  WHERE mp.product_id IS NOT NULL
  GROUP BY mp.product_id
)
SELECT
  p.id AS product_id,
  mb.country_code,
  p.name AS product_name,
  p.cnk_code AS cnk,
  p.brand_name,
  p.brand_id,
  p.category_id,
  p.popularity,
  mb.mk_best_ht,
  mb.offer_id AS mk_best_offer_id,
  mb.vendor_id AS mk_best_vendor_id,
  COALESCE(v.company_name, v.name) AS mk_best_vendor_name,
  mb.mk_offers_count::int,
  m2.mk_2nd_ht,
  eb.external_best_ht,
  eb.external_best_source,
  eb.external_best_url,
  COALESCE(eb.external_offers_count, 0) AS external_offers_count,
  ma.pharm_ht AS market_pharm_ht,
  ma.grossiste_ht AS market_grossiste_ht,
  ma.public_ht AS market_public_ht,
  (p.pvp_ttc_cents::numeric / 100.0) AS pvp_ttc,
  CASE WHEN eb.external_best_ht IS NOT NULL AND eb.external_best_ht > 0 AND mb.mk_best_ht IS NOT NULL
       THEN round(((mb.mk_best_ht - eb.external_best_ht) / eb.external_best_ht) * 100, 1)
  END AS delta_vs_external_pct,
  CASE WHEN m2.mk_2nd_ht IS NOT NULL AND m2.mk_2nd_ht > 0 AND mb.mk_best_ht IS NOT NULL
       THEN round(((mb.mk_best_ht - m2.mk_2nd_ht) / m2.mk_2nd_ht) * 100, 1)
  END AS delta_vs_internal_pct,
  GREATEST(
    COALESCE(CASE WHEN eb.external_best_ht > 0 THEN ((mb.mk_best_ht - eb.external_best_ht) / eb.external_best_ht) * 100 END, 0),
    COALESCE(CASE WHEN ma.pharm_ht > 0 THEN ((mb.mk_best_ht - ma.pharm_ht) / ma.pharm_ht) * 100 END, 0),
    COALESCE(CASE WHEN ma.grossiste_ht > 0 THEN ((mb.mk_best_ht - ma.grossiste_ht) / ma.grossiste_ht) * 100 END, 0)
  ) AS worst_action_score,
  now() AS refreshed_at
FROM public.products p
JOIN mk_best mb ON mb.product_id = p.id
LEFT JOIN mk_2nd m2 ON m2.product_id = p.id AND m2.country_code = mb.country_code
LEFT JOIN ext_best eb ON eb.product_id = p.id
LEFT JOIN market_agg ma ON ma.product_id = p.id
LEFT JOIN public.vendors v ON v.id = mb.vendor_id
WHERE p.is_active = true;

-- Indexes
CREATE UNIQUE INDEX admin_price_cockpit_mv_pk
  ON public.admin_price_cockpit_mv(product_id, country_code);
CREATE INDEX admin_price_cockpit_mv_score
  ON public.admin_price_cockpit_mv(country_code, worst_action_score DESC NULLS LAST);
CREATE INDEX admin_price_cockpit_mv_brand
  ON public.admin_price_cockpit_mv(brand_id);
CREATE INDEX admin_price_cockpit_mv_cat
  ON public.admin_price_cockpit_mv(category_id);

-- 2. Refresh function
CREATE OR REPLACE FUNCTION public.refresh_admin_price_cockpit_mv()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _started timestamptz := clock_timestamp();
  _rows int;
BEGIN
  -- Allow admins or service_role (cron)
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.admin_price_cockpit_mv;
  SELECT count(*) INTO _rows FROM public.admin_price_cockpit_mv;

  RETURN jsonb_build_object(
    'rows', _rows,
    'duration_ms', round(extract(epoch from clock_timestamp() - _started) * 1000)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_admin_price_cockpit_mv() FROM public;
GRANT EXECUTE ON FUNCTION public.refresh_admin_price_cockpit_mv() TO authenticated, service_role;

-- 3. Rewrite kpis to read from MV
CREATE OR REPLACE FUNCTION public.admin_price_cockpit_kpis(_country text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _r jsonb;
  _cc text := COALESCE(_country, 'ALL');
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT jsonb_build_object(
    'mk_higher_than_external', count(*) FILTER (WHERE external_best_ht IS NOT NULL AND mk_best_ht > external_best_ht),
    'mk_higher_internal',      count(*) FILTER (WHERE mk_2nd_ht IS NOT NULL AND mk_best_ht > mk_2nd_ht),
    'active_products_total',   (SELECT count(*) FROM public.products WHERE is_active = true),
    'active_products_without_offer',
      (SELECT count(*) FROM public.products p
        WHERE p.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM public.admin_price_cockpit_mv m
            WHERE m.product_id = p.id AND m.country_code = _cc
          )),
    'avg_delta_vs_external_pct',
      round(avg(delta_vs_external_pct) FILTER (WHERE delta_vs_external_pct IS NOT NULL)::numeric, 1),
    'refreshed_at', max(refreshed_at)
  )
  INTO _r
  FROM public.admin_price_cockpit_mv
  WHERE country_code = _cc;

  RETURN _r;
END;
$$;

-- 4. Rewrite rows to read from MV
CREATE OR REPLACE FUNCTION public.admin_price_cockpit_rows(
  _country text DEFAULT NULL,
  _brand_id uuid DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _min_delta_pct numeric DEFAULT NULL,
  _only_mk_higher boolean DEFAULT true,
  _limit int DEFAULT 200,
  _offset int DEFAULT 0
)
RETURNS TABLE(
  product_id uuid, product_name text, cnk text, brand_name text, brand_id uuid, category_id uuid,
  mk_best_ht numeric, mk_best_offer_id uuid, mk_best_vendor_id uuid, mk_best_vendor_name text,
  mk_offers_count integer, mk_2nd_ht numeric,
  external_best_ht numeric, external_best_source text, external_best_url text,
  market_pharm_ht numeric, market_grossiste_ht numeric, market_public_ht numeric,
  pvp_ttc numeric, delta_vs_external_pct numeric, delta_vs_internal_pct numeric,
  worst_action_score numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _cc text := COALESCE(_country, 'ALL');
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT
    m.product_id, m.product_name, m.cnk, m.brand_name, m.brand_id, m.category_id,
    m.mk_best_ht, m.mk_best_offer_id, m.mk_best_vendor_id, m.mk_best_vendor_name,
    m.mk_offers_count, m.mk_2nd_ht,
    m.external_best_ht, m.external_best_source, m.external_best_url,
    m.market_pharm_ht, m.market_grossiste_ht, m.market_public_ht,
    m.pvp_ttc, m.delta_vs_external_pct, m.delta_vs_internal_pct,
    m.worst_action_score
  FROM public.admin_price_cockpit_mv m
  WHERE m.country_code = _cc
    AND (_brand_id IS NULL OR m.brand_id = _brand_id)
    AND (_category_id IS NULL OR m.category_id = _category_id)
    AND (
      _only_mk_higher = false
      OR (m.external_best_ht IS NOT NULL AND m.mk_best_ht > m.external_best_ht)
      OR (m.market_pharm_ht IS NOT NULL AND m.mk_best_ht > m.market_pharm_ht)
      OR (m.market_grossiste_ht IS NOT NULL AND m.mk_best_ht > m.market_grossiste_ht)
      OR (m.mk_2nd_ht IS NOT NULL AND m.mk_best_ht > m.mk_2nd_ht)
    )
    AND (_min_delta_pct IS NULL OR m.worst_action_score >= _min_delta_pct)
  ORDER BY m.worst_action_score DESC NULLS LAST, m.product_name ASC
  LIMIT _limit OFFSET _offset;
END;
$$;

-- Initial populate (CONCURRENTLY would fail on first run, do plain refresh once)
REFRESH MATERIALIZED VIEW public.admin_price_cockpit_mv;
