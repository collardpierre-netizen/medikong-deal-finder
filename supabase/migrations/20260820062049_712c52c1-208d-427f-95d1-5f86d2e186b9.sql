-- 1) Vendor eligibility settings for flash sales
CREATE TABLE public.flash_sale_vendor_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid NOT NULL UNIQUE REFERENCES public.vendors(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  max_discount_pct numeric,
  allow_real_name boolean NOT NULL DEFAULT false,
  internal_note text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flash_sale_vendor_settings TO authenticated;
GRANT ALL ON public.flash_sale_vendor_settings TO service_role;

ALTER TABLE public.flash_sale_vendor_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flash_sale_vendor_settings_admin_all"
ON public.flash_sale_vendor_settings
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TRIGGER trg_flash_sale_vendor_settings_updated_at
BEFORE UPDATE ON public.flash_sale_vendor_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_flash_sale_vendor_settings_enabled
ON public.flash_sale_vendor_settings (is_enabled) WHERE is_enabled;

-- 2) Vendor list with flash-sale status (admin only)
CREATE OR REPLACE FUNCTION public.admin_flash_sale_vendors()
RETURNS TABLE (
  vendor_id uuid,
  vendor_name text,
  company_name text,
  display_code text,
  vendor_type text,
  validation_status text,
  active_offers_count bigint,
  is_enabled boolean,
  max_discount_pct numeric,
  allow_real_name boolean,
  internal_note text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.name::text,
    v.company_name::text,
    v.display_code::text,
    v.type::text,
    v.validation_status::text,
    COALESCE(o.cnt, 0),
    COALESCE(s.is_enabled, false),
    s.max_discount_pct,
    COALESCE(s.allow_real_name, false),
    s.internal_note
  FROM public.vendors v
  LEFT JOIN (
    SELECT vendor_id, count(*) AS cnt
    FROM public.offers
    WHERE is_active = true AND COALESCE(admin_hidden, false) = false
    GROUP BY vendor_id
  ) o ON o.vendor_id = v.id
  LEFT JOIN public.flash_sale_vendor_settings s ON s.vendor_id = v.id
  WHERE public.is_admin()
  ORDER BY COALESCE(o.cnt, 0) DESC, COALESCE(v.company_name, v.name);
$$;

REVOKE ALL ON FUNCTION public.admin_flash_sale_vendors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_flash_sale_vendors() TO authenticated, service_role;

-- 3) Flash deal candidate offers (admin only)
CREATE OR REPLACE FUNCTION public.admin_flash_deal_candidates(
  _only_enabled_vendors boolean DEFAULT true,
  _min_margin_pct numeric DEFAULT NULL,
  _min_stock integer DEFAULT NULL,
  _search text DEFAULT NULL,
  _vendor_ids uuid[] DEFAULT NULL,
  _limit integer DEFAULT 100
)
RETURNS TABLE (
  offer_id uuid,
  product_id uuid,
  product_name text,
  brand_name text,
  gtin text,
  vendor_id uuid,
  vendor_label text,
  vendor_enabled boolean,
  vendor_max_discount_pct numeric,
  price_excl_vat numeric,
  purchase_price_excl_vat numeric,
  margin_amount numeric,
  margin_pct numeric,
  stock_quantity integer,
  moq integer,
  product_best_price_incl_vat numeric,
  pvp_ttc_cents integer,
  market_pharmacist_price numeric,
  market_gap_pct numeric,
  already_in_flash boolean,
  potential_score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mk AS (
    SELECT product_id, min(prix_pharmacien) AS market_price
    FROM public.market_prices
    WHERE prix_pharmacien IS NOT NULL AND prix_pharmacien > 0 AND product_id IS NOT NULL
    GROUP BY product_id
  ),
  base AS (
    SELECT
      o.id AS offer_id,
      o.product_id,
      p.name::text AS product_name,
      p.brand_name::text AS brand_name,
      p.gtin::text AS gtin,
      o.vendor_id,
      COALESCE(v.company_name, v.name, v.display_code)::text AS vendor_label,
      COALESCE(s.is_enabled, false) AS vendor_enabled,
      s.max_discount_pct AS vendor_max_discount_pct,
      o.price_excl_vat,
      o.purchase_price_excl_vat,
      CASE
        WHEN o.purchase_price_excl_vat IS NOT NULL AND o.price_excl_vat IS NOT NULL
          THEN o.price_excl_vat - o.purchase_price_excl_vat
        ELSE o.margin_amount
      END AS margin_amount,
      CASE
        WHEN o.price_excl_vat IS NOT NULL AND o.price_excl_vat > 0
             AND o.purchase_price_excl_vat IS NOT NULL
          THEN round(((o.price_excl_vat - o.purchase_price_excl_vat) / o.price_excl_vat) * 100, 2)
        ELSE o.applied_margin_percentage
      END AS margin_pct,
      o.stock_quantity,
      o.moq,
      p.best_price_incl_vat AS product_best_price_incl_vat,
      p.pvp_ttc_cents,
      mk.market_price AS market_pharmacist_price,
      CASE
        WHEN mk.market_price IS NOT NULL AND mk.market_price > 0 AND o.price_excl_vat IS NOT NULL
          THEN round(((mk.market_price - o.price_excl_vat) / mk.market_price) * 100, 2)
        ELSE NULL
      END AS market_gap_pct,
      EXISTS (
        SELECT 1 FROM public.flash_deals fd
        WHERE fd.is_active = true
          AND fd.ends_at > now()
          AND (fd.offer_id = o.id OR (fd.offer_id IS NULL AND fd.product_id = o.product_id))
      ) AS already_in_flash
    FROM public.offers o
    JOIN public.products p ON p.id = o.product_id
    JOIN public.vendors v ON v.id = o.vendor_id
    LEFT JOIN public.flash_sale_vendor_settings s ON s.vendor_id = o.vendor_id
    LEFT JOIN mk ON mk.product_id = o.product_id
    WHERE public.is_admin()
      AND o.is_active = true
      AND COALESCE(o.admin_hidden, false) = false
      AND COALESCE(o.price_stale, false) = false
      AND p.is_active = true
      AND (_only_enabled_vendors IS NOT TRUE OR COALESCE(s.is_enabled, false) = true)
      AND (_vendor_ids IS NULL OR o.vendor_id = ANY(_vendor_ids))
      AND (_min_stock IS NULL OR COALESCE(o.stock_quantity, 0) >= _min_stock)
      AND (
        _search IS NULL OR _search = ''
        OR p.name ILIKE '%' || _search || '%'
        OR p.brand_name ILIKE '%' || _search || '%'
        OR p.gtin ILIKE '%' || _search || '%'
      )
  )
  SELECT
    b.offer_id,
    b.product_id,
    b.product_name,
    b.brand_name,
    b.gtin,
    b.vendor_id,
    b.vendor_label,
    b.vendor_enabled,
    b.vendor_max_discount_pct,
    b.price_excl_vat,
    b.purchase_price_excl_vat,
    b.margin_amount,
    b.margin_pct,
    b.stock_quantity,
    b.moq,
    b.product_best_price_incl_vat,
    b.pvp_ttc_cents,
    b.market_pharmacist_price,
    b.market_gap_pct,
    b.already_in_flash,
    round(
      COALESCE(b.margin_pct, 0) * 0.5
      + COALESCE(b.market_gap_pct, 0) * 0.3
      + LEAST(COALESCE(b.stock_quantity, 0), 500) / 500.0 * 20
      - CASE WHEN b.already_in_flash THEN 40 ELSE 0 END
    , 2) AS potential_score
  FROM base b
  WHERE (_min_margin_pct IS NULL OR COALESCE(b.margin_pct, -999) >= _min_margin_pct)
  ORDER BY 21 DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 100), 500));
$$;

REVOKE ALL ON FUNCTION public.admin_flash_deal_candidates(boolean, numeric, integer, text, uuid[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_flash_deal_candidates(boolean, numeric, integer, text, uuid[], integer) TO authenticated, service_role;