
-- 1) customer_shipping_addresses : SELECT pour le client propriétaire
CREATE POLICY "Customers read own shipping addresses"
  ON public.customer_shipping_addresses
  FOR SELECT
  TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()));

-- 2) restock_offers : remplacer la policy seller incorrecte
DROP POLICY IF EXISTS "Sellers manage own offers" ON public.restock_offers;
CREATE POLICY "Sellers manage own offers"
  ON public.restock_offers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restock_buyers rb
      WHERE rb.id = restock_offers.seller_id
        AND rb.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restock_buyers rb
      WHERE rb.id = restock_offers.seller_id
        AND rb.auth_user_id = auth.uid()
        AND rb.verified_status = 'verified'
    )
  );

-- 2bis) restock_counter_offers : remplacer les policies seller
DROP POLICY IF EXISTS "Sellers see counter offers on own offers" ON public.restock_counter_offers;
CREATE POLICY "Sellers see counter offers on own offers"
  ON public.restock_counter_offers
  FOR SELECT
  TO authenticated
  USING (
    offer_id IN (
      SELECT ro.id
      FROM public.restock_offers ro
      JOIN public.restock_buyers rb ON rb.id = ro.seller_id
      WHERE rb.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers update counter offers on own offers" ON public.restock_counter_offers;
CREATE POLICY "Sellers update counter offers on own offers"
  ON public.restock_counter_offers
  FOR UPDATE
  TO authenticated
  USING (
    offer_id IN (
      SELECT ro.id
      FROM public.restock_offers ro
      JOIN public.restock_buyers rb ON rb.id = ro.seller_id
      WHERE rb.auth_user_id = auth.uid()
    )
  );

-- 3) sourcing_requests : SELECT pour le client propriétaire
CREATE POLICY "Customers read own sourcing requests"
  ON public.sourcing_requests
  FOR SELECT
  TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()));
