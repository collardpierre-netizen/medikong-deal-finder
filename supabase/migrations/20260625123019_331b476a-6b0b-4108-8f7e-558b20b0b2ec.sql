
-- 1. external_offers: require authentication for read
DROP POLICY IF EXISTS external_offers_read ON public.external_offers;
CREATE POLICY external_offers_read_authenticated ON public.external_offers
  FOR SELECT TO authenticated USING (true);

-- 2. restock_offers: published visible to authenticated only
DROP POLICY IF EXISTS "Published offers visible to all" ON public.restock_offers;
CREATE POLICY "Published offers visible to authenticated" ON public.restock_offers
  FOR SELECT TO authenticated USING (status = 'published');

-- 3. restock_shipments: fix buyers policy to use restock_buyers
DROP POLICY IF EXISTS "Buyers view own shipments" ON public.restock_shipments;
CREATE POLICY "Buyers view own shipments" ON public.restock_shipments
  FOR SELECT TO authenticated
  USING (buyer_id IN (SELECT rb.id FROM public.restock_buyers rb WHERE rb.auth_user_id = auth.uid()));

-- 4. savings_simulations: add user_id, replace email-JWT policy
ALTER TABLE public.savings_simulations ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_savings_simulations_user_id ON public.savings_simulations(user_id);

DROP POLICY IF EXISTS "Owners read own savings_simulations" ON public.savings_simulations;
CREATE POLICY "Owners read own savings_simulations" ON public.savings_simulations
  FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

-- 5. vendor_invoice_payment_settings: restrict to verified buyers/admins
DROP POLICY IF EXISTS "Verified buyers can read enabled vendor invoice settings" ON public.vendor_invoice_payment_settings;
CREATE POLICY "Verified buyers can read enabled vendor invoice settings" ON public.vendor_invoice_payment_settings
  FOR SELECT TO authenticated
  USING (enabled = true AND public.is_verified_buyer_or_admin(auth.uid()));

-- 6. Storage policy: customers can read their own order PDFs
DROP POLICY IF EXISTS "Customers read own order pdfs" ON storage.objects;
CREATE POLICY "Customers read own order pdfs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'order-pdfs'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.id::text = (storage.foldername(name))[1]
        AND c.auth_user_id = auth.uid()
    )
  );

-- 7. Storage policy: owners can read their own savings reports
DROP POLICY IF EXISTS "Owners read own savings reports" ON storage.objects;
CREATE POLICY "Owners read own savings reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'savings-reports'
    AND EXISTS (
      SELECT 1 FROM public.savings_simulations s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.user_id IS NOT NULL
        AND s.user_id = auth.uid()
    )
  );
