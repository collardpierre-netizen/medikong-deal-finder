WITH parsed AS (
  SELECT
    id,
    COALESCE(
      -- "N-x-<chiffre>" (ex: 15-x-500-ml)
      NULLIF((regexp_match(product_url, '[-/](\d{1,3})-x-\d', 'i'))[1], '')::int,
      -- "N-x-<lettre>" (ex: 24-x-cup, 15-x-easy-bag)
      NULLIF((regexp_match(product_url, '[-/](\d{1,3})-x-[a-z]', 'i'))[1], '')::int,
      -- "N-pcs"
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