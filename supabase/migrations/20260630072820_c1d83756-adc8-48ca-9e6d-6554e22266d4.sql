
CREATE OR REPLACE FUNCTION public.get_best_offers_for_products(
  _product_ids uuid[],
  _country text,
  _buyer_profile_id text DEFAULT NULL
)
RETURNS TABLE(
  product_id uuid,
  offer_id uuid,
  vendor_id uuid,
  vendor_name text,
  vendor_company_name text,
  vendor_display_name text,
  vendor_display_code text,
  vendor_is_verified boolean,
  vendor_show_real_name boolean,
  vendor_show_real_name_resolved boolean,
  effective_price_excl_vat numeric,
  effective_price_incl_vat numeric,
  price_source text,
  delivery_days int,
  stock_quantity numeric,
  offer_count int,
  total_stock numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT o.id AS offer_id,
           o.product_id,
           o.vendor_id,
           o.price_excl_vat AS base_price_excl_vat,
           o.price_incl_vat AS base_price_incl_vat,
           o.delivery_days,
           o.stock_quantity
    FROM public.offers o
    WHERE o.product_id = ANY(_product_ids)
      AND o.is_active = true
      AND o.country_code = _country
  ),
  priced AS (
    SELECT b.*,
           COALESCE(
             (SELECT v.effective_price_excl_vat
              FROM public.effective_offer_prices_v v
              WHERE v.offer_id = b.offer_id
                AND v.buyer_profile_id = COALESCE(_buyer_profile_id, '')
              LIMIT 1),
             b.base_price_excl_vat
           ) AS eff_excl,
           COALESCE(
             (SELECT v.effective_price_incl_vat
              FROM public.effective_offer_prices_v v
              WHERE v.offer_id = b.offer_id
                AND v.buyer_profile_id = COALESCE(_buyer_profile_id, '')
              LIMIT 1),
             b.base_price_incl_vat
           ) AS eff_incl,
           COALESCE(
             (SELECT v.price_source
              FROM public.effective_offer_prices_v v
              WHERE v.offer_id = b.offer_id
                AND v.buyer_profile_id = COALESCE(_buyer_profile_id, '')
              LIMIT 1),
             'offer_base'
           ) AS src
    FROM base b
  ),
  agg AS (
    SELECT product_id,
           COUNT(*)::int AS offer_count,
           COALESCE(SUM(stock_quantity), 0) AS total_stock
    FROM base
    GROUP BY product_id
  ),
  ranked AS (
    SELECT p.*,
           ROW_NUMBER() OVER (PARTITION BY p.product_id ORDER BY p.eff_excl ASC NULLS LAST, p.offer_id) AS rn
    FROM priced p
  )
  SELECT r.product_id,
         r.offer_id,
         r.vendor_id,
         vp.name,
         vp.company_name,
         vp.display_name,
         vp.display_code,
         vp.is_verified,
         vp.show_real_name,
         COALESCE((
           SELECT vr.show_real_name
           FROM public.vendor_visibility_rules vr
           WHERE vr.vendor_id = r.vendor_id
             AND (vr.country_code IS NULL OR vr.country_code = _country)
             AND (vr.customer_type IS NULL OR vr.customer_type = COALESCE(_buyer_profile_id, ''))
           ORDER BY vr.priority DESC NULLS LAST
           LIMIT 1
         ), vp.show_real_name) AS vendor_show_real_name_resolved,
         r.eff_excl,
         r.eff_incl,
         r.src,
         r.delivery_days,
         r.stock_quantity,
         a.offer_count,
         a.total_stock
  FROM ranked r
  JOIN agg a ON a.product_id = r.product_id
  LEFT JOIN public.vendors_public vp ON vp.id = r.vendor_id
  WHERE r.rn = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_best_offers_for_products(uuid[], text, text) TO anon, authenticated, service_role;
