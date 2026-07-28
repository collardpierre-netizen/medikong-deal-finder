-- ── Tier 1 : bump existing dermo heroes to level 2 ─────────────────
UPDATE public.brands SET is_priority = 2 WHERE is_priority > 0;

-- ── Tier 1 additions (accent/case-insensitive via norm_key) ────────
WITH t1(t) AS (VALUES ('René Furterer'),('Topicrem'),('Galénic'),('Noreva'))
UPDATE public.brands b
SET is_priority = 2
FROM t1
WHERE b.norm_key = public.normalize_brand_name(t1.t)
   OR (length(public.normalize_brand_name(t1.t)) >= 6
       AND b.norm_key LIKE public.normalize_brand_name(t1.t) || '%');

-- ── Tier 2 : master list of common pharmacy brands ─────────────────
WITH terms(t) AS (VALUES
('Cetaphil'),('RoC'),('Institut Esthederm'),('Esthederm'),('Rilastil'),('Sesderma'),('Endocare'),('Martiderm'),('Payot'),('Talika'),('Novexpert'),('Naqi'),('Mixa'),('Neutrogena'),('Melvita'),('Dr. Hauschka'),('Lavera'),('Phyto'),('Phytosolba'),('Nioxin'),('Christophe Robin'),('Bepanthen'),('Bepanthol'),('Cicabio'),('Ialuset'),('Flamigel'),('Piz Buin'),('Ambre Solaire'),('Laboratoires de Biarritz'),('Alga Maris'),('EQ'),
('Elmex'),('Meridol'),('GUM'),('Parodontax'),('Sensodyne'),('Oral-B'),('Curaprox'),('Inava'),('Fluocaril'),('Arthrodont'),('Eludril'),('Paroex'),('Hextril'),
('Bion3'),('Berocca'),('Supradyn'),('Arkopharma'),('Forté Pharma'),('Nutergia'),('Pileje'),('Solgar'),('Aragan'),('Granions'),('Oligobs'),('Juvamine'),('Vitavea'),('Nutrisanté'),('Boiron'),('Lero'),('Densmore'),('Cooper'),('Oenobiol'),('Inneov'),('Naturactive'),('Superdiet'),('Nat&Form'),('Puressentiel'),('Pranarom'),('Ladrôme'),('Metagenics'),('Be-Life'),('Ortis'),('Nutriphyt'),('Physalis'),('Aboca'),('Tilman'),('IxX Pharma'),('Qualiphar'),('Trenker'),('Revogan'),('Anaca3'),('XLS Medical'),
('Mustela'),('Bioderma ABCDerm'),('Weleda Baby'),('Mam'),('Philips Avent'),('Dodie'),('Nuk'),('Difrax'),('Novalac'),('Physiolac'),('Gallia'),('Guigoz'),('Nutrilon'),('Hipp'),('Modilac'),('Picot'),('Nutricia'),('Bledina'),
('Urgo'),('Compeed'),('Hansaplast'),('Nexcare'),('Elastoplast'),('Steripan'),('Biseptine'),('Mercurochrome'),('Hibiscrub'),('Ialugen'),('Comfeel'),('Duoderm'),('Mepilex'),('Aquacel'),('Scholl'),('Akileine'),('Pedirelax'),('Omron'),('Hartmann'),('Thermoval'),
('Saforelle'),('Rogé Cavaillès'),('Hydralin'),('Gynophilus'),('Mucogyne'),('Multi-Gyn'),('Paranix'),('Pouxit'),('Marie Rose'),('Mouskito')
), nt AS (SELECT public.normalize_brand_name(t) AS k FROM terms)
UPDATE public.brands b
SET is_priority = 1
FROM nt
WHERE COALESCE(b.is_priority, 0) = 0
  AND b.norm_key NOT IN ('cooperscentedproducts','coopermatic')
  AND (b.norm_key = nt.k OR (length(nt.k) >= 6 AND b.norm_key LIKE nt.k || '%'));

-- ── Re-sync denormalised products.brand_priority ───────────────────
UPDATE public.products p
SET brand_priority = COALESCE(b.is_priority, 0)
FROM public.brands b
WHERE p.brand_id = b.id
  AND COALESCE(p.brand_priority, 0) <> COALESCE(b.is_priority, 0);

UPDATE public.products p
SET brand_priority = 0
WHERE p.brand_id IS NULL AND COALESCE(p.brand_priority, 0) <> 0;

-- ── Priority lane honours the 2 tiers ──────────────────────────────
CREATE OR REPLACE FUNCTION public.select_priority_scrape_targets(
  _limit int DEFAULT 30,
  _fresh_hours int DEFAULT 48
)
RETURNS TABLE (product_id uuid, last_verified_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS product_id,
         MAX(o.last_verified_at) AS last_verified_at
  FROM public.products p
  JOIN public.offers o
    ON o.product_id = p.id
   AND o.is_qogita_backed = true
   AND o.is_active = true
  WHERE p.brand_priority > 0
    AND p.qogita_fid IS NOT NULL
    AND p.qogita_slug IS NOT NULL
  GROUP BY p.id, p.brand_priority
  HAVING MAX(o.last_verified_at) IS NULL
      OR MAX(o.last_verified_at) < (now() - make_interval(hours => GREATEST(_fresh_hours, 1)))
  ORDER BY p.brand_priority DESC, MAX(o.last_verified_at) ASC NULLS FIRST
  LIMIT GREATEST(_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.select_priority_scrape_targets(int, int) TO service_role;