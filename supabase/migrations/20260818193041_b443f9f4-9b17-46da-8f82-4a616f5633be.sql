CREATE OR REPLACE FUNCTION public.offers_low_outlier_ratio(_product_id uuid, _offer_id uuid, _base numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _base IS NULL OR _base <= 0 THEN NULL
    ELSE _base / NULLIF((
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY o.qogita_base_price)
      FROM public.offers o
      WHERE o.product_id = _product_id
        AND o.id <> COALESCE(_offer_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND o.is_active = true
        AND o.qogita_base_price IS NOT NULL
        AND o.qogita_base_price > 0
      HAVING COUNT(*) >= 2
    ), 0)
  END;
$$;