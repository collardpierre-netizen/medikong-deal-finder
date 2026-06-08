
-- Restrict anon column access on offers (sensitive financial/commission/admin fields)
REVOKE SELECT ON public.offers FROM anon;
GRANT SELECT (
  id, product_id, vendor_id, qogita_offer_qid, qogita_base_delay_days, is_qogita_backed,
  price_excl_vat, price_incl_vat, vat_rate, moq, mov, stock_quantity, stock_status,
  delivery_days, shipping_from_country, price_tiers, is_active, synced_at, created_at,
  updated_at, country_code, mov_amount, mov_currency, is_traceable, has_extended_delivery,
  min_delivery_days, max_delivery_days, estimated_delivery_days, down_payment_pct,
  qogita_seller_fid, is_top_seller, campaign_id, suggested_retail_price_cents,
  suggested_retail_price_source, pack_size_override, admin_hidden, carton_size_override,
  packaging_languages, vendor_note
) ON public.offers TO anon;

-- Restrict anon column access on vendor_exclusivities (internal contract terms)
REVOKE SELECT ON public.vendor_exclusivities FROM anon;
GRANT SELECT (
  id, vendor_id, scope, brand_id, manufacturer_id, product_id, category_id,
  mode, valid_from, valid_until, country_codes, is_active, created_at, updated_at
) ON public.vendor_exclusivities TO anon;
