-- Backfill external_offers.pack_size_override depuis l'URL produit du vendeur
-- (slug e-commerce du type "...-24-x-cup-125-gr_1" ou "...-46-pcs"), uniquement
-- si aucun override manuel n'a deja ete saisi.
WITH parsed AS (
  SELECT
    id,
    COALESCE(
      NULLIF((regexp_match(product_url, '[-/](\d{1,3})-x-\d', 'i'))[1], '')::int,
      NULLIF((regexp_match(product_url, '[-/](\d{1,3})-pcs?\b', 'i'))[1], '')::int
    ) AS detected_pack
  FROM public.external_offers
  WHERE is_active = true
    AND pack_size_override IS NULL
    AND product_url IS NOT NULL
)
UPDATE public.external_offers eo
SET pack_size_override = p.detected_pack,
    updated_at = now()
FROM parsed p
WHERE eo.id = p.id
  AND p.detected_pack BETWEEN 2 AND 500;