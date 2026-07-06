
-- Sécurité : bloquer l'accès anonyme (non connecté) aux colonnes internes
-- (prix d'achat, marges, commissions, notes vendeur, source fournisseur, tarif Qogita)
-- sur la table public.offers. Les utilisateurs connectés (vendeurs/admins/acheteurs)
-- conservent l'accès actuel via les politiques RLS existantes.

-- On révoque tout SELECT anon puis on réaccorde seulement les colonnes publiques.
REVOKE SELECT ON public.offers FROM anon;

GRANT SELECT (
  id,
  product_id,
  vendor_id,
  qogita_offer_qid,
  qogita_base_delay_days,
  is_qogita_backed,
  price_excl_vat,
  price_incl_vat,
  vat_rate,
  moq,
  mov,
  stock_quantity,
  stock_status,
  delivery_days,
  shipping_from_country,
  price_tiers,
  is_active,
  synced_at,
  created_at,
  updated_at,
  country_code,
  mov_amount,
  mov_currency,
  is_traceable,
  has_extended_delivery,
  min_delivery_days,
  max_delivery_days,
  estimated_delivery_days,
  down_payment_pct,
  qogita_seller_fid,
  is_top_seller,
  campaign_id,
  suggested_retail_price_cents,
  suggested_retail_price_source,
  pack_size_override,
  admin_hidden,
  admin_hidden_at,
  carton_size_override,
  packaging_languages,
  last_sync_run_id
) ON public.offers TO anon;
