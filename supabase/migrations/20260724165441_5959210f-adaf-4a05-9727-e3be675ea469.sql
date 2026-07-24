
ALTER TABLE public.order_invoices
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_order_invoices_stripe_checkout_session
  ON public.order_invoices (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
