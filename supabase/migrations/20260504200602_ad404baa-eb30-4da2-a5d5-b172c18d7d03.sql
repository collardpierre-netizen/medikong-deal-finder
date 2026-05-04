-- Backfill : recalcule TVA + TTC pour les offres mismatchées
WITH r AS (
  SELECT o.id,
         o.price_excl_vat,
         (SELECT vat_rate FROM public.resolve_product_vat_rate(o.product_id, COALESCE(o.country_code,'BE'))) AS rr
  FROM public.offers o
  WHERE o.is_active = true
)
UPDATE public.offers o
SET vat_rate = r.rr,
    price_incl_vat = ROUND((o.price_excl_vat * (1 + r.rr/100))::numeric, 2)
FROM r
WHERE r.id = o.id
  AND r.rr IS NOT NULL
  AND o.price_excl_vat IS NOT NULL
  AND ABS(o.price_incl_vat - ROUND((o.price_excl_vat * (1 + r.rr/100))::numeric, 2)) > 0.02;