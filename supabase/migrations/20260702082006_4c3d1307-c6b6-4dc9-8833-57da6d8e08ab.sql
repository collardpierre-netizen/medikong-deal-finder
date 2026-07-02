
-- Restore data-api access to offers with column-level protection for cost/margin
-- Grant table access to service_role (edge functions, admin)
GRANT ALL ON public.offers TO service_role;

-- Grant column-level SELECT on non-sensitive columns to anon + authenticated.
-- Excluded (sensitive): purchase_price, purchase_price_excl_vat, qogita_base_price,
--   qogita_seller_fid, applied_margin_rule_id, applied_margin_percentage,
--   margin_amount, commission_model, commission_rate, margin_split_pct,
--   fixed_commission_amount, commission_override_status, commission_valid_from,
--   commission_valid_until, commission_override_reason, commission_override_updated_by,
--   commission_override_updated_at, admin_hidden_reason, admin_hidden_by,
--   vendor_note, last_sync_run_id
GRANT SELECT (
  id, product_id, vendor_id, qogita_offer_qid, qogita_base_delay_days, is_qogita_backed,
  price_excl_vat, price_incl_vat, vat_rate, moq, mov, stock_quantity, stock_status,
  delivery_days, shipping_from_country, price_tiers, is_active, synced_at, created_at,
  updated_at, country_code, mov_amount, mov_currency, is_traceable, has_extended_delivery,
  min_delivery_days, max_delivery_days, estimated_delivery_days, down_payment_pct,
  is_top_seller, campaign_id, suggested_retail_price_cents, suggested_retail_price_source,
  pack_size_override, admin_hidden, admin_hidden_at, carton_size_override,
  packaging_languages, source_supplier
) ON public.offers TO anon, authenticated;

-- Also allow authenticated to write on their own offers (RLS still enforces ownership)
GRANT INSERT, UPDATE, DELETE ON public.offers TO authenticated;

-- Public-safe view (excludes cost/margin/commission/purchase columns).
-- security_invoker=on so RLS is enforced against the caller.
DROP VIEW IF EXISTS public.offers_public_v CASCADE;
CREATE VIEW public.offers_public_v
WITH (security_invoker = on) AS
SELECT
  id, product_id, vendor_id, qogita_offer_qid, qogita_base_delay_days, is_qogita_backed,
  price_excl_vat, price_incl_vat, vat_rate, moq, mov, stock_quantity, stock_status,
  delivery_days, shipping_from_country, price_tiers, is_active, synced_at, created_at,
  updated_at, country_code, mov_amount, mov_currency, is_traceable, has_extended_delivery,
  min_delivery_days, max_delivery_days, estimated_delivery_days, down_payment_pct,
  is_top_seller, campaign_id, suggested_retail_price_cents, suggested_retail_price_source,
  pack_size_override, admin_hidden, admin_hidden_at, carton_size_override,
  packaging_languages, source_supplier
FROM public.offers;

GRANT SELECT ON public.offers_public_v TO anon, authenticated;
GRANT ALL ON public.offers_public_v TO service_role;
