BEGIN;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Brands publicly readable" ON public.brands;
DROP POLICY IF EXISTS "Public can read active brands" ON public.brands;

CREATE POLICY "Public can read active brands"
ON public.brands
FOR SELECT
TO anon, authenticated
USING (is_active IS TRUE);

REVOKE SELECT ON public.brands FROM anon, authenticated;

GRANT SELECT (
  id, qogita_qid, name, slug, logo_url, description, product_count,
  is_featured, is_active, synced_at, manufacturer_id, website_url,
  country_of_origin, parent_company, country_hq, main_category,
  subcategories, year_entered_be_market, afmps_status, ce_marking,
  certifications, manufacturing_countries, inami_reimbursement_pct,
  inami_categories, google_trends_12m, google_trends_trend_pct,
  officinal_coverage_pct, press_mentions_12m, distribution_type,
  is_top20, sources_last_updated, created_at, updated_at, description_en
) ON public.brands TO anon, authenticated;

COMMIT;