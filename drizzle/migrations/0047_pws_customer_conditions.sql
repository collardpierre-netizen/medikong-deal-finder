ALTER TABLE public.pharmacist_wholesaler_settings ALTER COLUMN buyer_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pws_customer_wholesaler_uniq
  ON public.pharmacist_wholesaler_settings (customer_id, wholesaler_profile_id)
  WHERE customer_id IS NOT NULL;
ALTER TABLE public.pharmacist_wholesaler_settings
  ADD CONSTRAINT pws_owner_present CHECK (buyer_id IS NOT NULL OR customer_id IS NOT NULL);