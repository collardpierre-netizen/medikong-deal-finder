
-- 1. market_prices : restrict to admins + vendors (was: any verified buyer)
DROP POLICY IF EXISTS verified_read_market_prices ON public.market_prices;
CREATE POLICY vendors_and_admins_read_market_prices
  ON public.market_prices FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.auth_user_id = auth.uid() AND v.is_active = true)
  );

-- 2. gamme_demand_signals : ensure buyer owner + admin read policies
CREATE POLICY gamme_buyer_read_own
  ON public.gamme_demand_signals FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

CREATE POLICY gamme_admin_read_all
  ON public.gamme_demand_signals FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3a. restock_ratings : tighten INSERT with transaction participation check
DROP POLICY IF EXISTS "Rater can insert own rating" ON public.restock_ratings;
CREATE POLICY "Rater can insert own rating"
  ON public.restock_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.restock_transactions t
      WHERE t.id = restock_ratings.transaction_id
        AND (
          (rater_role = 'buyer'  AND t.buyer_id  = auth.uid() AND t.seller_id = restock_ratings.ratee_id)
          OR
          (rater_role = 'seller' AND t.seller_id = auth.uid() AND t.buyer_id  = restock_ratings.ratee_id)
        )
    )
  );

-- 3b. restock_ratings : restrict SELECT to participants + admins
DROP POLICY IF EXISTS "Anyone authenticated can read ratings" ON public.restock_ratings;
CREATE POLICY "Participants and admins read ratings"
  ON public.restock_ratings FOR SELECT
  TO authenticated
  USING (
    rater_id = auth.uid()
    OR ratee_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.restock_transactions t
      WHERE t.id = restock_ratings.transaction_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );
