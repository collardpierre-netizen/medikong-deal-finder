ALTER TABLE public.vendor_delegates 
  ADD COLUMN IF NOT EXISTS primary_target_profiles text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_vendor_delegates_primary_targets 
  ON public.vendor_delegates USING gin(primary_target_profiles);