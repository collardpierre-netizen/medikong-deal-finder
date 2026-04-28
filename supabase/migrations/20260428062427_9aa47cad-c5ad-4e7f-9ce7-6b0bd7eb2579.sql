-- ============================================================
-- 1. EXTEND brands TABLE
-- ============================================================
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS parent_company text,
  ADD COLUMN IF NOT EXISTS country_hq text,
  ADD COLUMN IF NOT EXISTS main_category text,
  ADD COLUMN IF NOT EXISTS subcategories text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS year_entered_be_market integer,
  ADD COLUMN IF NOT EXISTS afmps_status text CHECK (afmps_status IN ('agreed','not_applicable','not_agreed')),
  ADD COLUMN IF NOT EXISTS ce_marking boolean,
  ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS manufacturing_countries text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS inami_reimbursement_pct numeric CHECK (inami_reimbursement_pct >= 0 AND inami_reimbursement_pct <= 100),
  ADD COLUMN IF NOT EXISTS inami_categories jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS google_trends_12m jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS google_trends_trend_pct numeric,
  ADD COLUMN IF NOT EXISTS officinal_coverage_pct numeric CHECK (officinal_coverage_pct >= 0 AND officinal_coverage_pct <= 100),
  ADD COLUMN IF NOT EXISTS press_mentions_12m integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distribution_type text CHECK (distribution_type IN ('official','authorized','partner')),
  ADD COLUMN IF NOT EXISTS is_top20 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sources_last_updated timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_brands_updated_at ON public.brands;
CREATE TRIGGER trg_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. brand_logistics_stats VIEW (90 days, security_invoker)
-- ============================================================
DROP VIEW IF EXISTS public.brand_logistics_stats;
CREATE VIEW public.brand_logistics_stats
WITH (security_invoker = true) AS
WITH win AS (
  SELECT (now() - interval '90 days') AS since
)
SELECT
  b.id AS brand_id,
  b.slug AS brand_slug,
  COUNT(DISTINCT o.id)::int AS order_count_90d,
  ROUND(AVG(EXTRACT(EPOCH FROM (o.estimated_delivery_date::timestamptz - o.created_at)) / 86400.0)::numeric, 1) AS avg_delivery_days,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE off.stock_status = 'in_stock')
      / NULLIF(COUNT(*), 0)::numeric
  , 1) AS stock_availability_pct,
  ROUND(AVG(o.total_incl_vat)::numeric, 2) AS avg_order_value
FROM public.brands b
LEFT JOIN public.products p ON p.brand_id = b.id
LEFT JOIN public.order_items oi ON oi.product_id = p.id
LEFT JOIN public.orders o ON o.id = oi.order_id
  AND o.created_at >= (SELECT since FROM win)
  AND o.status NOT IN ('cancelled')
LEFT JOIN public.offers off ON off.id = oi.offer_id
GROUP BY b.id, b.slug;

GRANT SELECT ON public.brand_logistics_stats TO anon, authenticated;

-- ============================================================
-- 3. brand_reviews TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  brand_slug text NOT NULL,
  reviewer_user_id uuid NOT NULL,
  reviewer_initials text NOT NULL,
  reviewer_city text,
  verified_buyer_orders_count integer NOT NULL DEFAULT 0,
  rating_quality integer NOT NULL CHECK (rating_quality BETWEEN 1 AND 5),
  rating_delivery integer NOT NULL CHECK (rating_delivery BETWEEN 1 AND 5),
  rating_support integer NOT NULL CHECK (rating_support BETWEEN 1 AND 5),
  rating_documentation integer NOT NULL CHECK (rating_documentation BETWEEN 1 AND 5),
  rating_margin integer NOT NULL CHECK (rating_margin BETWEEN 1 AND 5),
  comment text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, reviewer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_reviews_brand_id ON public.brand_reviews(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_reviews_brand_slug ON public.brand_reviews(brand_slug);
CREATE INDEX IF NOT EXISTS idx_brand_reviews_user ON public.brand_reviews(reviewer_user_id);

DROP TRIGGER IF EXISTS trg_brand_reviews_updated_at ON public.brand_reviews;
CREATE TRIGGER trg_brand_reviews_updated_at
  BEFORE UPDATE ON public.brand_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brand_reviews ENABLE ROW LEVEL SECURITY;

-- Helper: a user has at least one delivered/paid order containing this brand
CREATE OR REPLACE FUNCTION public.user_has_ordered_brand(_user_id uuid, _brand_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.products p ON p.id = oi.product_id
    WHERE c.auth_user_id = _user_id
      AND p.brand_id = _brand_id
      AND o.status NOT IN ('cancelled')
  );
$$;

-- Public read of published reviews
CREATE POLICY "brand_reviews_public_read"
  ON public.brand_reviews FOR SELECT
  USING (is_published = true);

-- Verified buyers can insert their own review (one per brand via UNIQUE constraint)
CREATE POLICY "brand_reviews_verified_insert"
  ON public.brand_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_user_id = auth.uid()
    AND public.user_has_ordered_brand(auth.uid(), brand_id)
  );

-- Author can update / delete their own review
CREATE POLICY "brand_reviews_author_update"
  ON public.brand_reviews FOR UPDATE
  TO authenticated
  USING (reviewer_user_id = auth.uid())
  WITH CHECK (reviewer_user_id = auth.uid());

CREATE POLICY "brand_reviews_author_delete"
  ON public.brand_reviews FOR DELETE
  TO authenticated
  USING (reviewer_user_id = auth.uid());

-- Admins manage everything
CREATE POLICY "brand_reviews_admin_all"
  ON public.brand_reviews FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- 4. Top 20 recompute helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_brand_top20()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH sales_per_brand AS (
    SELECT p.brand_id, SUM(oi.quantity)::bigint AS units
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.orders o ON o.id = oi.order_id
    WHERE p.brand_id IS NOT NULL
      AND o.created_at >= now() - interval '90 days'
      AND o.status NOT IN ('cancelled')
    GROUP BY p.brand_id
  ),
  ranked AS (
    SELECT brand_id, units,
           ROW_NUMBER() OVER (ORDER BY units DESC) AS rn
    FROM sales_per_brand
  )
  UPDATE public.brands b
  SET is_top20 = (b.id IN (SELECT brand_id FROM ranked WHERE rn <= 20));
END;
$$;