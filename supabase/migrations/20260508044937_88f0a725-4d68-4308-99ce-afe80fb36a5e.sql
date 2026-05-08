DROP MATERIALIZED VIEW IF EXISTS public.public_marketplace_metrics;

CREATE MATERIALIZED VIEW public.public_marketplace_metrics AS
SELECT
  1::int AS singleton,
  (SELECT COUNT(DISTINCT v.id)
     FROM public.vendors v
     JOIN public.offers o ON o.vendor_id = v.id
    WHERE v.is_verified = true
      AND v.validation_status IN ('accepted','approved')
      AND o.is_active = true) AS suppliers_count,
  (SELECT COUNT(DISTINCT b.id)
     FROM public.brands b
     JOIN public.products p ON p.brand_id = b.id
     JOIN public.offers o ON o.product_id = p.id
    WHERE b.is_active = true
      AND p.is_active = true
      AND o.is_active = true) AS brands_count,
  (SELECT COUNT(DISTINCT p.id)
     FROM public.products p
     JOIN public.offers o ON o.product_id = p.id
    WHERE p.is_active = true
      AND o.is_active = true) AS products_count,
  (SELECT COUNT(*) FROM public.offers WHERE is_active = true) AS offers_count,
  (SELECT COUNT(DISTINCT fd.product_id)
     FROM public.flash_deals fd
    WHERE fd.is_active = true
      AND fd.starts_at <= now()
      AND fd.ends_at >= now()) AS products_on_promo,
  (SELECT ROUND(AVG(offer_count)::numeric, 1)
     FROM (
       SELECT product_id, COUNT(*) AS offer_count
         FROM public.offers
        WHERE is_active = true
        GROUP BY product_id
     ) sub) AS avg_offers_per_product,
  now() AS refreshed_at;

CREATE UNIQUE INDEX public_marketplace_metrics_singleton_idx
  ON public.public_marketplace_metrics (singleton);

CREATE OR REPLACE FUNCTION public.refresh_public_marketplace_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.public_marketplace_metrics;
END;
$$;

GRANT SELECT ON public.public_marketplace_metrics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_public_marketplace_metrics() TO service_role;