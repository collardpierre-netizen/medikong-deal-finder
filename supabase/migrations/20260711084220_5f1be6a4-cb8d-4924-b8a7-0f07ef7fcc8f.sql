
-- Revoke blanket SELECT from anon, then re-grant only non-sensitive columns.
-- Authenticated + service_role keep full access (governed by existing RLS policies).

REVOKE SELECT ON public.offers FROM anon;
GRANT SELECT (
  id, product_id, vendor_id,
  qogita_offer_qid, qogita_base_delay_days, is_qogita_backed,
  price_excl_vat, price_incl_vat, vat_rate,
  moq, mov, stock_quantity, stock_status,
  delivery_days, shipping_from_country, price_tiers,
  applied_margin_rule_id,
  is_active, synced_at, created_at, updated_at,
  country_code, mov_amount, mov_currency,
  is_traceable, has_extended_delivery,
  min_delivery_days, max_delivery_days, estimated_delivery_days,
  down_payment_pct, is_top_seller, campaign_id,
  suggested_retail_price_cents, suggested_retail_price_source,
  pack_size_override,
  commission_override_status, commission_valid_from, commission_valid_until,
  admin_hidden,
  vendor_note, carton_size_override, packaging_languages,
  source_supplier, last_sync_run_id, country_codes
) ON public.offers TO anon;

REVOKE SELECT ON public.offer_price_tiers FROM anon;
GRANT SELECT (
  id, offer_id, tier_index, mov_threshold, mov_currency,
  price_excl_vat, price_incl_vat, is_active, mov_progress,
  created_at
) ON public.offer_price_tiers TO anon;
