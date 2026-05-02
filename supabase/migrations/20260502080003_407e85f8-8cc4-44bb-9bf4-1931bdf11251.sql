CREATE OR REPLACE VIEW public.product_pack_audit_v
WITH (security_invoker = true) AS
WITH detected AS (
  SELECT
    p.id,
    p.name,
    p.slug,
    p.cnk_code,
    p.pack_size,
    -- Heuristique SQL sur le nom (sous-ensemble du JS, suffisant pour audit)
    CASE
      -- CERP "/N" en fin de libellé
      WHEN p.name ~* '(^|\s)/\s*(\d{1,3})\s*$' THEN
        NULLIF((regexp_match(p.name, '(?:^|\s)/\s*(\d{1,3})\s*$'))[1], '')::int
      -- N x Q ml/g/cl/l/mg/cc (ex: "4 x 125 ml")
      WHEN p.name ~* '(\d{1,3})\s*[x×]\s*\d+\s*(ml|g|cl|l|mg|cc|kcal)\b' THEN
        NULLIF((regexp_match(p.name, '(\d{1,3})\s*[x×]\s*\d+\s*(?:ml|g|cl|l|mg|cc|kcal)\b', 'i'))[1], '')::int
      -- Boîte/Pack/Lot/Etui de N
      WHEN p.name ~* '(?:bo[iî]te|pack|lot|[ée]tui|carton|blister)\s*(?:de\s*)?(\d{1,3})\b' THEN
        NULLIF((regexp_match(p.name, '(?:bo[iî]te|pack|lot|[ée]tui|carton|blister)\s*(?:de\s*)?(\d{1,3})\b', 'i'))[1], '')::int
      -- N caps/capsules/cps/comp/cp/cpr/sachets/sticks/ampoules/gel/comprimes
      WHEN p.name ~* '\b(\d{1,3})\s*(caps?|capsules?|cps|comp(?:rim[eé]s?)?|cpr?|gel|gel\.|sachets?|sticks?|ampoules?|doses?)\b' THEN
        NULLIF((regexp_match(p.name, '\b(\d{1,3})\s*(?:caps?|capsules?|cps|comp(?:rim[eé]s?)?|cpr?|gel|gel\.|sachets?|sticks?|ampoules?|doses?)\b', 'i'))[1], '')::int
      -- "trailing N" CERP compact (espace + N en fin) — borné
      WHEN p.name ~* '\s(\d{1,2})\s*$'
           AND p.name !~* '\b(mg|ml|g|kg|cl|l|kcal|cc|oz|mcg|ug|ui|iu|mm|cm|m|%)\s+\d{1,2}\s*$' THEN
        NULLIF((regexp_match(p.name, '\s(\d{1,2})\s*$'))[1], '')::int
      ELSE NULL
    END AS heuristic_pack
  FROM public.products p
  WHERE p.is_active = true
),
ext_packs AS (
  SELECT
    eo.product_id,
    array_agg(DISTINCT eo.pack_size_override ORDER BY eo.pack_size_override)
      FILTER (WHERE eo.pack_size_override IS NOT NULL AND eo.pack_size_override > 0) AS external_overrides,
    COUNT(*) FILTER (WHERE eo.is_active) AS external_offers_count,
    COUNT(*) FILTER (WHERE eo.is_active AND eo.pack_size_override IS NOT NULL) AS external_with_override
  FROM public.external_offers eo
  GROUP BY eo.product_id
),
mk_offers AS (
  SELECT product_id, COUNT(*) FILTER (WHERE is_active) AS mk_offers_count
  FROM public.offers GROUP BY product_id
)
SELECT
  d.id                              AS product_id,
  d.name                            AS product_name,
  d.slug                            AS product_slug,
  d.cnk_code,
  d.pack_size                       AS product_pack_size,
  d.heuristic_pack                  AS heuristic_pack_size,
  COALESCE(ep.external_overrides, ARRAY[]::int[]) AS external_pack_overrides,
  -- pack effectif "présumé" = pack_size produit > heuristique nom > 1
  GREATEST(COALESCE(d.pack_size, d.heuristic_pack, 1), 1) AS effective_pack_size,
  CASE
    WHEN d.pack_size IS NOT NULL AND d.pack_size > 0 THEN 'product_pack_size'
    WHEN d.heuristic_pack IS NOT NULL THEN 'name_heuristic'
    ELSE 'fallback'
  END AS effective_source,
  COALESCE(ep.external_offers_count, 0) AS external_offers_count,
  COALESCE(ep.external_with_override, 0) AS external_with_override_count,
  COALESCE(mk.mk_offers_count, 0)        AS mk_offers_count,
  -- Statut : à corriger ?
  CASE
    -- Plusieurs overrides externes incohérents entre eux
    WHEN ep.external_overrides IS NOT NULL AND array_length(ep.external_overrides, 1) > 1
      THEN 'external_conflict'
    -- Override externe unanime ≠ pack produit
    WHEN ep.external_overrides IS NOT NULL
         AND array_length(ep.external_overrides, 1) = 1
         AND ep.external_overrides[1] <> COALESCE(d.pack_size, 1)
      THEN 'external_vs_product_mismatch'
    -- Heuristique nom ≠ pack produit (et pack produit défini)
    WHEN d.pack_size IS NOT NULL AND d.heuristic_pack IS NOT NULL
         AND d.pack_size <> d.heuristic_pack
      THEN 'product_vs_heuristic_mismatch'
    -- Pack produit non défini mais heuristique trouvée
    WHEN (d.pack_size IS NULL OR d.pack_size = 1)
         AND d.heuristic_pack IS NOT NULL AND d.heuristic_pack > 1
      THEN 'missing_product_pack_size'
    ELSE 'ok'
  END AS pack_resolution_status
FROM detected d
LEFT JOIN ext_packs ep ON ep.product_id = d.id
LEFT JOIN mk_offers mk ON mk.product_id = d.id;

REVOKE ALL ON public.product_pack_audit_v FROM PUBLIC;
GRANT SELECT ON public.product_pack_audit_v TO authenticated;