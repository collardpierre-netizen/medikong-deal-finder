
-- Add matched_product_id to restock_offers
ALTER TABLE public.restock_offers
  ADD COLUMN IF NOT EXISTS matched_product_id uuid REFERENCES public.products(id);

CREATE INDEX IF NOT EXISTS idx_restock_offers_matched_product ON public.restock_offers(matched_product_id);

-- View joining restock offers with MediKong catalog prices
CREATE OR REPLACE VIEW public.restock_offers_with_delta
WITH (security_invoker = true) AS
SELECT
  o.id,
  o.ean,
  o.cnk,
  o.designation,
  o.quantity,
  o.price_ht,
  o.price_ttc,
  o.vat_rate,
  o.dlu,
  o.product_state,
  o.grade,
  o.delivery_condition,
  o.photo_url,
  o.product_image_url,
  o.packaging_photos,
  o.allow_partial,
  o.moq,
  o.lot_size,
  o.unit_weight_g,
  o.seller_city,
  o.status,
  o.views_count,
  o.drop_id,
  o.created_at,
  o.updated_at,
  o.expires_at,
  o.matched_product_id,
  -- MediKong new product info
  p.name AS medikong_product_name,
  p.image_url AS medikong_image_url,
  p.best_price_excl_vat AS medikong_price_ht,
  p.best_price_incl_vat AS medikong_price_ttc,
  p.gtin AS medikong_ean,
  -- Delta calculation
  CASE
    WHEN p.best_price_excl_vat IS NOT NULL AND p.best_price_excl_vat > 0
    THEN ROUND((1 - o.price_ht / p.best_price_excl_vat) * 100, 1)
    ELSE NULL
  END AS savings_pct,
  CASE
    WHEN p.best_price_excl_vat IS NOT NULL AND p.best_price_excl_vat > 0
    THEN ROUND(p.best_price_excl_vat - o.price_ht, 2)
    ELSE NULL
  END AS savings_amount
FROM public.restock_offers o
LEFT JOIN public.products p ON p.id = o.matched_product_id;
