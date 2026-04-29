
WITH resolved AS (
  SELECT o.id,
         o.price_excl_vat,
         o.vat_rate AS old_rate,
         (SELECT vat_rate FROM public.resolve_product_vat_rate(o.product_id, o.country_code)) AS new_rate
  FROM public.offers o
  WHERE o.is_active = true
    AND o.price_excl_vat IS NOT NULL
),
to_update AS (
  SELECT id, price_excl_vat, new_rate
  FROM resolved
  WHERE new_rate IS NOT NULL
    AND new_rate IS DISTINCT FROM old_rate
),
updated AS (
  UPDATE public.offers o
  SET vat_rate = u.new_rate,
      price_incl_vat = ROUND(u.price_excl_vat * (1 + u.new_rate / 100.0), 2),
      updated_at = now()
  FROM to_update u
  WHERE o.id = u.id
  RETURNING o.id
)
INSERT INTO public.audit_logs (action, module, detail)
SELECT
  'offers_vat_recompute',
  'offers',
  'Recalcul TVA offres : ' || COUNT(*)::text || ' offres mises à jour suite à la correction des vat_rate de catégories.'
FROM updated;
