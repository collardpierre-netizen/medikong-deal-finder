-- Idempotence : drop policy si déjà existante
DROP POLICY IF EXISTS "Public can read active vendors (safe columns)" ON public.vendors;

-- Révoquer tout SELECT anon par défaut (paranoïa défense en profondeur)
REVOKE SELECT ON public.vendors FROM anon;

-- GRANT column-level whitelist (miroir exact de la projection vendors_public)
GRANT SELECT (
  id, slug, name, company_name, type, country_code, city,
  logo_url, cover_image_url, description, tagline,
  website, linkedin_url, facebook_url, instagram_url, twitter_url, youtube_url,
  is_verified, is_top_seller, rating, total_sales,
  display_code, show_real_name, preferred_language, created_at, is_active
) ON public.vendors TO anon;

-- RLS policy SELECT anon : ligne autorisée uniquement si vendeur actif
CREATE POLICY "Public can read active vendors (safe columns)"
ON public.vendors FOR SELECT TO anon
USING (is_active = true);