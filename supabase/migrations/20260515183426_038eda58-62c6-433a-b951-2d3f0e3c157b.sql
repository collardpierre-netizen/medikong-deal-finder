ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

COMMENT ON COLUMN public.vendors.contact_email IS
  'Optional dedicated email for order notifications. Fallback chain (used by send-vendor-order-emails): contact_email → shipping_email → email.';