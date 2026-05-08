-- Drop existing if any
DROP VIEW IF EXISTS public.public_vendor_trust_signals CASCADE;

CREATE VIEW public.public_vendor_trust_signals
WITH (security_invoker = true)
AS
WITH delivery_perf AS (
  SELECT
    so.vendor_id,
    COUNT(*) AS orders_90d,
    COUNT(*) FILTER (
      WHERE so.shipped_at IS NOT NULL
        AND so.estimated_delivery_date IS NOT NULL
        AND so.shipped_at::date <= so.estimated_delivery_date
    ) AS on_time_90d
  FROM public.sub_orders so
  WHERE so.created_at > now() - interval '90 days'
    AND so.status IN ('shipped'::fulfillment_status, 'delivered'::fulfillment_status)
  GROUP BY so.vendor_id
),
totals AS (
  SELECT vendor_id, COUNT(*) AS total_orders
  FROM public.sub_orders
  WHERE status IN ('shipped'::fulfillment_status, 'delivered'::fulfillment_status)
  GROUP BY vendor_id
),
ratings AS (
  SELECT
    v.id AS vendor_id,
    ROUND(AVG(r.stars)::numeric, 1) AS avg_score,
    COUNT(*) AS ratings_count
  FROM public.restock_ratings r
  JOIN public.vendors v ON v.auth_user_id = r.ratee_id
  WHERE r.rater_role = 'buyer'
    AND r.created_at > now() - interval '12 months'
  GROUP BY v.id
),
kyc AS (
  SELECT
    s.vendor_id,
    bool_or(s.status = 'approved') AS is_kyc_verified,
    bool_or(s.status = 'approved' AND c.label ILIKE '%AFMPS%') AS is_fagg_verified
  FROM public.vendor_kyc_submissions s
  JOIN public.vendor_kyc_criteria c ON c.id = s.criteria_id
  GROUP BY s.vendor_id
),
ship_country AS (
  SELECT DISTINCT ON (vendor_id)
    vendor_id,
    country
  FROM public.vendor_addresses
  ORDER BY vendor_id, is_default DESC, created_at ASC
)
SELECT
  v.id AS vendor_id,
  -- Mode d'affichage dérivé de show_real_name (compat existant)
  CASE WHEN v.show_real_name THEN 'public' ELSE 'anonymous' END AS display_mode,
  -- Identifiant public : display_code 6 chars existant, fallback sur l'UUID
  COALESCE(v.display_code, UPPER(SUBSTR(REPLACE(v.id::text, '-', ''), 1, 6))) AS public_identifier,
  -- Nom commercial uniquement si autorisé
  CASE WHEN v.show_real_name THEN COALESCE(v.company_name, v.name) ELSE NULL END AS company_name,
  v.created_at AS joined_at,
  -- Ancienneté en mois
  GREATEST(0,
    (EXTRACT(YEAR FROM age(now(), v.created_at)) * 12
     + EXTRACT(MONTH FROM age(now(), v.created_at)))::int
  ) AS months_active,
  -- KYC
  COALESCE(k.is_kyc_verified, false) AS is_kyc_verified,
  COALESCE(k.is_fagg_verified, false) AS is_fagg_verified,
  -- Origine d'expédition (vendor_addresses sinon shipping_country du vendeur)
  COALESCE(sc.country, v.shipping_country, v.country_code) AS ships_from_country,
  -- Fiabilité livraison (≥ 10 commandes nécessaires)
  CASE
    WHEN COALESCE(dp.orders_90d, 0) >= 10
      THEN ROUND(100.0 * dp.on_time_90d::numeric / dp.orders_90d, 0)::int
    ELSE NULL
  END AS on_time_pct_90d,
  COALESCE(dp.orders_90d, 0) AS orders_90d_count,
  -- Note moyenne
  r.avg_score,
  COALESCE(r.ratings_count, 0)::int AS ratings_count,
  -- Volume total
  COALESCE(t.total_orders, 0)::int AS total_orders,
  now() AS computed_at
FROM public.vendors v
LEFT JOIN delivery_perf dp ON dp.vendor_id = v.id
LEFT JOIN ratings r ON r.vendor_id = v.id
LEFT JOIN totals t ON t.vendor_id = v.id
LEFT JOIN kyc k ON k.vendor_id = v.id
LEFT JOIN ship_country sc ON sc.vendor_id = v.id
WHERE v.is_active = true;

GRANT SELECT ON public.public_vendor_trust_signals TO anon, authenticated;

COMMENT ON VIEW public.public_vendor_trust_signals IS
  'Signaux de confiance par vendeur (KYC, livraison, ancienneté, avis, volume). Vue publique en security_invoker.';