-- Add buyer address fields to restock_transactions for address exchange
ALTER TABLE public.restock_transactions
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS buyer_company text,
  ADD COLUMN IF NOT EXISTS buyer_street text,
  ADD COLUMN IF NOT EXISTS buyer_city text,
  ADD COLUMN IF NOT EXISTS buyer_postal_code text,
  ADD COLUMN IF NOT EXISTS buyer_country text DEFAULT 'BE',
  ADD COLUMN IF NOT EXISTS buyer_phone text,
  ADD COLUMN IF NOT EXISTS buyer_email text,
  ADD COLUMN IF NOT EXISTS buyer_vat_number text,
  ADD COLUMN IF NOT EXISTS billing_same_as_shipping boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_notes text,
  ADD COLUMN IF NOT EXISTS seller_pickup_address text,
  ADD COLUMN IF NOT EXISTS seller_pickup_city text,
  ADD COLUMN IF NOT EXISTS seller_pickup_phone text,
  ADD COLUMN IF NOT EXISTS seller_pickup_instructions text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Fix: allow anon/public to read active drops (was working but let's ensure)
DROP POLICY IF EXISTS "Anyone can read active drops" ON public.restock_drops;
CREATE POLICY "Anyone can read active drops" ON public.restock_drops
  FOR SELECT USING (true);

-- Fix: allow published offers to be visible without auth too (for landing pages)
DROP POLICY IF EXISTS "Published offers visible to all auth" ON public.restock_offers;
CREATE POLICY "Published offers visible to all" ON public.restock_offers
  FOR SELECT USING (status = 'published');

-- Allow authenticated users to insert transactions
CREATE POLICY "Authenticated users create transactions"
  ON public.restock_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow buyers to update their own transactions (for adding address at checkout)  
CREATE POLICY "Buyers update own transactions"
  ON public.restock_transactions FOR UPDATE
  TO authenticated
  USING (buyer_id IN (SELECT id FROM restock_buyers WHERE auth_user_id = auth.uid()));
