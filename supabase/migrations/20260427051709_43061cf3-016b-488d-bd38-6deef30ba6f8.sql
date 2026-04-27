
-- 1. Install triggers on offers so denormalized aggregates on products stay in sync
--    This fixes the "Pas encore d'offre" display on public catalog cards.

DROP TRIGGER IF EXISTS trg_offers_update_product_aggregates ON public.offers;
CREATE TRIGGER trg_offers_update_product_aggregates
AFTER INSERT OR UPDATE OR DELETE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.update_product_aggregates();

DROP TRIGGER IF EXISTS trg_offers_update_product_country_stats ON public.offers;
CREATE TRIGGER trg_offers_update_product_country_stats
AFTER INSERT OR UPDATE OR DELETE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.update_product_country_stats();

-- 2. Install pricing trigger so qogita-backed offers compute price_excl/incl_vat
DROP TRIGGER IF EXISTS trg_offers_calculate_prices ON public.offers;
CREATE TRIGGER trg_offers_calculate_prices
BEFORE INSERT OR UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.calculate_offer_prices();

-- 3. Discount % auto-calc on products
DROP TRIGGER IF EXISTS trg_products_calculate_discount ON public.products;
CREATE TRIGGER trg_products_calculate_discount
BEFORE INSERT OR UPDATE OF best_price_incl_vat, reference_price ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.calculate_discount_percentage();

-- 4. updated_at maintenance
DROP TRIGGER IF EXISTS trg_offers_set_updated_at ON public.offers;
CREATE TRIGGER trg_offers_set_updated_at
BEFORE UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 5. Backfill: rebuild stale aggregates for ALL products that have at least one active offer
--    but a wrong best_price_excl_vat / offer_count / stock.
WITH agg AS (
  SELECT
    o.product_id,
    MIN(o.price_excl_vat) FILTER (WHERE o.is_active) AS best_excl,
    MIN(o.price_incl_vat) FILTER (WHERE o.is_active) AS best_incl,
    COUNT(*) FILTER (WHERE o.is_active) AS oc,
    COALESCE(SUM(o.stock_quantity) FILTER (WHERE o.is_active), 0) AS ts,
    MIN(o.delivery_days) FILTER (WHERE o.is_active) AS mind,
    BOOL_OR(o.is_active AND o.stock_quantity > 0) AS in_stock
  FROM public.offers o
  GROUP BY o.product_id
)
UPDATE public.products p
SET
  best_price_excl_vat = agg.best_excl,
  best_price_incl_vat = agg.best_incl,
  offer_count = COALESCE(agg.oc, 0),
  total_stock = COALESCE(agg.ts, 0),
  min_delivery_days = agg.mind,
  is_in_stock = COALESCE(agg.in_stock, false),
  updated_at = now()
FROM agg
WHERE p.id = agg.product_id
  AND (
    COALESCE(p.best_price_excl_vat,0) IS DISTINCT FROM COALESCE(agg.best_excl,0)
    OR COALESCE(p.offer_count,0) IS DISTINCT FROM COALESCE(agg.oc,0)
    OR COALESCE(p.total_stock,0) IS DISTINCT FROM COALESCE(agg.ts,0)
    OR COALESCE(p.is_in_stock,false) IS DISTINCT FROM COALESCE(agg.in_stock,false)
  );
