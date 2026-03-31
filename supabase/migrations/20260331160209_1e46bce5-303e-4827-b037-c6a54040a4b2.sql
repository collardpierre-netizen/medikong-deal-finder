-- Add Stripe Connect fields to vendors table
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false;

-- Create order_transfers table for tracking Stripe transfers
CREATE TABLE IF NOT EXISTS public.order_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  stripe_transfer_id text,
  amount integer NOT NULL DEFAULT 0,
  commission_amount integer NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0.20,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add stripe_payment_intent_id to orders if not exists
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- RLS for order_transfers
ALTER TABLE public.order_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage order_transfers"
  ON public.order_transfers FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role manages order_transfers"
  ON public.order_transfers FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_order_transfers_order_id ON public.order_transfers(order_id);
CREATE INDEX IF NOT EXISTS idx_order_transfers_vendor_id ON public.order_transfers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_stripe_account_id ON public.vendors(stripe_account_id) WHERE stripe_account_id IS NOT NULL;