UPDATE public.order_lines ol
SET product_id = p.id
FROM public.products p
WHERE ol.product_id IS NULL
  AND ol.manual_label IS NOT NULL
  AND lower(btrim(p.name)) = lower(btrim(ol.manual_label))
  AND NOT EXISTS (
    SELECT 1 FROM public.products p2
    WHERE lower(btrim(p2.name)) = lower(btrim(ol.manual_label))
      AND p2.id <> p.id
  );