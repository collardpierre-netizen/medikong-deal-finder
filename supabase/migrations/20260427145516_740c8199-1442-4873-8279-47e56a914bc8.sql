-- Vue publique des vendeurs : champs non sensibles uniquement
-- Utilisée par l'UI catalogue (fiches produit, marques, recherche, page vendeur publique)
-- security_invoker = true => respecte la RLS de la table vendors
CREATE OR REPLACE VIEW public.vendors_public
WITH (security_invoker = true)
AS
SELECT
  v.id,
  v.slug,
  -- Masque le vrai nom si le vendeur ne souhaite pas l'afficher
  CASE
    WHEN v.show_real_name = true THEN COALESCE(v.company_name, v.name)
    ELSE COALESCE(NULLIF(v.tagline, ''), 'Vendeur vérifié')
  END AS display_name,
  -- Nom commercial uniquement si le vendeur a opté pour l'affichage public
  CASE WHEN v.show_real_name = true THEN v.name END AS name,
  CASE WHEN v.show_real_name = true THEN v.company_name END AS company_name,
  v.type,
  v.country_code,
  v.city,
  v.logo_url,
  v.cover_image_url,
  v.description,
  v.tagline,
  v.website,
  v.linkedin_url,
  v.facebook_url,
  v.instagram_url,
  v.twitter_url,
  v.youtube_url,
  v.is_verified,
  v.is_top_seller,
  v.rating,
  v.total_sales,
  v.display_code,
  v.show_real_name,
  v.preferred_language,
  v.created_at
FROM public.vendors v
WHERE v.is_active = true;

COMMENT ON VIEW public.vendors_public IS
'Vue publique des vendeurs : aucun PII (email, tel, adresse, TVA, IDs Stripe/Sendcloud, taux de commission). À utiliser dans toute UI catalogue (fiches produit, marques, recherche, page vendeur publique). security_invoker=true => RLS de vendors respectée.';

GRANT SELECT ON public.vendors_public TO anon, authenticated;