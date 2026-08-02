UPDATE public.order_items oi
SET
  offer_id = m.id,
  vendor_id_snapshot = m.vendor_id,
  applied_margin_pct_snapshot = m.applied_margin_percentage,
  is_qogita_backed_snapshot = m.is_qogita_backed,
  cagnotte_eligible_snapshot = COALESCE(m.cagnotte_eligible, false)
FROM (
  SELECT DISTINCT ON (oi_inner.id)
    oi_inner.id AS order_item_id,
    o.id,
    o.vendor_id,
    o.applied_margin_percentage,
    o.is_qogita_backed,
    o.cagnotte_eligible
  FROM public.order_items oi_inner
  JOIN public.offers o ON o.product_id = oi_inner.product_id
  WHERE oi_inner.offer_id IS NULL
    AND o.is_active = true
  ORDER BY oi_inner.id, o.applied_margin_percentage DESC NULLS LAST
) m
WHERE oi.id = m.order_item_id
  AND oi.offer_id IS NULL;