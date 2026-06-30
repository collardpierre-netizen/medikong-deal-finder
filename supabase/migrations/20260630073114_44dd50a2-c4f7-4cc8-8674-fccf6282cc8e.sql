
GRANT SELECT (
  id, product_id, vendor_id, qogita_offer_qid, is_qogita_backed,
  price_excl_vat, price_incl_vat, vat_rate,
  moq, mov, mov_amount, mov_currency,
  stock_quantity, stock_status,
  delivery_days, shipping_from_country, price_tiers,
  is_active, synced_at, created_at, updated_at, country_code,
  is_traceable, has_extended_delivery,
  min_delivery_days, max_delivery_days, estimated_delivery_days,
  is_top_seller, campaign_id,
  suggested_retail_price_cents, suggested_retail_price_source,
  pack_size_override, vendor_note,
  carton_size_override, packaging_languages
) ON TABLE public.offers TO anon, authenticated;

GRANT ALL ON TABLE public.offers TO service_role;
