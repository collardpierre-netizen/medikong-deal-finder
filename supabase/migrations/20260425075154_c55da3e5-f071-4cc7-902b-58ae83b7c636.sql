ALTER TABLE public.vendor_delegates 
  ADD COLUMN IF NOT EXISTS postal_codes text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_vendor_delegates_postal_codes 
  ON public.vendor_delegates USING gin(postal_codes);