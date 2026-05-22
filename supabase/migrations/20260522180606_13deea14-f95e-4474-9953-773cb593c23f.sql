CREATE INDEX IF NOT EXISTS idx_offers_vendor_active_sort
  ON public.offers (vendor_id, stock_status, price_excl_vat, created_at DESC)
  WHERE is_active = true;