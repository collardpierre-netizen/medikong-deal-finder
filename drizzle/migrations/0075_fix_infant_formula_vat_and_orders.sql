UPDATE public.offers o SET vat_rate = 6
FROM public.products p
WHERE p.id = o.product_id AND o.vat_rate = 21
  AND public.normalize_cnk(p.cnk_code) IN ('2159457','2159465','2899656','3289725','3963055','4291035','4480620','1658343','2159473','3083409','3198363','3963063','3963071','3963089','4127064','4299848');

UPDATE public.order_lines l SET vat_rate = 6,
  unit_price_incl_vat = ROUND(l.unit_price_excl_vat * 1.06, 2),
  line_total_incl_vat = ROUND(l.line_total_excl_vat * 1.06, 2)
FROM public.orders o
WHERE o.id = l.order_id AND l.vat_rate = 21
  AND o.order_number IN ('MK-MANUAL-2026-35852','MK-MANUAL-2026-53296');

UPDATE public.order_items i SET vat_rate = 0.06,
  unit_price_incl_vat = ROUND(i.unit_price_excl_vat * 1.06, 2),
  line_total_incl_vat = ROUND(i.line_total_excl_vat * 1.06, 2)
FROM public.orders o
WHERE o.id = i.order_id AND i.vat_rate = 0.21
  AND o.order_number IN ('MK-MANUAL-2026-35852','MK-MANUAL-2026-53296');

UPDATE public.orders o SET
  vat_amount = s.ttc - s.ht,
  total_incl_vat = o.total_incl_vat - o.vat_amount + (s.ttc - s.ht)
FROM (SELECT order_id, SUM(line_total_excl_vat) ht, SUM(line_total_incl_vat) ttc FROM public.order_lines GROUP BY order_id) s
WHERE s.order_id = o.id AND o.order_number IN ('MK-MANUAL-2026-35852','MK-MANUAL-2026-53296');