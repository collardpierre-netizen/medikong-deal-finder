ALTER TABLE public.restock_offers
  ADD COLUMN IF NOT EXISTS seller_postal_code text,
  ADD COLUMN IF NOT EXISTS seller_province text;