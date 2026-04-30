-- =========================================================
-- Fix 1: vendors_public must expose name & company_name
-- so that vendor_visibility_rules can actually reveal them.
-- The anonymization stays in code (getVendorPublicName) and
-- in RLS for sensitive vendor fields, NOT in this public view.
-- =========================================================
CREATE OR REPLACE VIEW public.vendors_public
WITH (security_invoker = true) AS
SELECT id,
       slug,
       CASE
           WHEN show_real_name = true THEN COALESCE(company_name, name)
           ELSE COALESCE(NULLIF(tagline, ''::text), 'Vendeur vérifié'::text)
       END AS display_name,
       -- Always expose raw name/company_name; anonymization is enforced
       -- by the front-end resolver which honors vendor_visibility_rules.
       name,
       company_name,
       type,
       country_code,
       city,
       logo_url,
       cover_image_url,
       description,
       tagline,
       website,
       linkedin_url,
       facebook_url,
       instagram_url,
       twitter_url,
       youtube_url,
       is_verified,
       is_top_seller,
       rating,
       total_sales,
       display_code,
       show_real_name,
       preferred_language,
       created_at
  FROM vendors v
 WHERE is_active = true;

-- =========================================================
-- Fix 2: dedup duplicate offers (vendor_id, product_id),
-- keep the most recently updated one, and prevent recurrence
-- via a UNIQUE index.
-- =========================================================
WITH ranked AS (
  SELECT id,
         vendor_id,
         product_id,
         ROW_NUMBER() OVER (
           PARTITION BY vendor_id, product_id
           ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
         ) AS rn
    FROM public.offers
)
DELETE FROM public.offers o
 USING ranked r
 WHERE o.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_offers_vendor_product
  ON public.offers(vendor_id, product_id);