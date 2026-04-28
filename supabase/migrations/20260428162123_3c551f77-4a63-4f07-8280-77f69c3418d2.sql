CREATE INDEX IF NOT EXISTS idx_offers_updated_at_desc ON public.offers (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_active_updated_at ON public.offers (is_active, updated_at DESC);