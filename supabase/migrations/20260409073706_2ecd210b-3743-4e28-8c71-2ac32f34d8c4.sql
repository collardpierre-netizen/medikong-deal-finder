
ALTER TABLE public.restock_offers
  ADD COLUMN IF NOT EXISTS publish_start timestamptz,
  ADD COLUMN IF NOT EXISTS publish_end timestamptz;
