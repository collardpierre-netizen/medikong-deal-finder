
-- ============================================================
-- 1. vendors: lock sensitive columns from self-updates
-- ============================================================
CREATE OR REPLACE FUNCTION public.vendors_block_sensitive_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass (also covers service_role which has no auth.uid())
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Restore protected columns to their old values for non-admin updates
  NEW.is_active              := OLD.is_active;
  NEW.is_verified            := OLD.is_verified;
  NEW.validation_status      := OLD.validation_status;
  NEW.commission_rate        := OLD.commission_rate;
  NEW.commission_model       := OLD.commission_model;
  NEW.margin_split_pct       := OLD.margin_split_pct;
  NEW.fixed_commission_amount := OLD.fixed_commission_amount;
  NEW.stripe_account_id      := OLD.stripe_account_id;
  NEW.stripe_payouts_enabled := OLD.stripe_payouts_enabled;
  NEW.stripe_charges_enabled := OLD.stripe_charges_enabled;
  NEW.stripe_details_submitted := OLD.stripe_details_submitted;
  NEW.can_manage_offers      := OLD.can_manage_offers;
  NEW.auth_user_id           := OLD.auth_user_id;
  NEW.kyc_status             := OLD.kyc_status;
  NEW.is_manufacturer        := OLD.is_manufacturer;
  NEW.display_code           := OLD.display_code;
  NEW.qogita_seller_alias    := OLD.qogita_seller_alias;
  NEW.accepts_rfq            := OLD.accepts_rfq;
  NEW.max_open_rfqs          := OLD.max_open_rfqs;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendors_block_sensitive_self_update ON public.vendors;
CREATE TRIGGER trg_vendors_block_sensitive_self_update
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.vendors_block_sensitive_self_update();

-- Tighten the WITH CHECK clause on the self-update policy
DROP POLICY IF EXISTS "Vendors manage own" ON public.vendors;
CREATE POLICY "Vendors manage own"
ON public.vendors
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- ============================================================
-- 2. buyer_p2p_listings: split write rights between seller / target buyer
-- ============================================================
CREATE OR REPLACE FUNCTION public.p2p_listings_block_unauthorized_field_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_ids uuid[];
  v_is_seller boolean := false;
  v_is_target boolean := false;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT ARRAY(SELECT public._current_user_buyer_ids()) INTO v_buyer_ids;
  v_is_seller := OLD.seller_buyer_id = ANY(v_buyer_ids);
  v_is_target := OLD.target_buyer_id IS NOT NULL AND OLD.target_buyer_id = ANY(v_buyer_ids);

  -- Identity columns are immutable for everyone except admins
  NEW.seller_buyer_id := OLD.seller_buyer_id;
  NEW.target_buyer_id := OLD.target_buyer_id;

  IF v_is_target AND NOT v_is_seller THEN
    -- Target buyer can only change status (accept/decline); freeze all financial fields
    NEW.unit_price_excl_vat_cents := OLD.unit_price_excl_vat_cents;
    NEW.commission_rate_bps       := OLD.commission_rate_bps;
    NEW.commission_enabled        := OLD.commission_enabled;
    NEW.valid_until               := OLD.valid_until;
    NEW.quantity                  := OLD.quantity;
    NEW.product_id                := OLD.product_id;
    NEW.offer_id                  := OLD.offer_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_p2p_listings_block_unauthorized_field_updates ON public.buyer_p2p_listings;
CREATE TRIGGER trg_p2p_listings_block_unauthorized_field_updates
BEFORE UPDATE ON public.buyer_p2p_listings
FOR EACH ROW
EXECUTE FUNCTION public.p2p_listings_block_unauthorized_field_updates();

-- Add a proper WITH CHECK to the existing policy
DROP POLICY IF EXISTS p2p_listings_update_party_or_admin ON public.buyer_p2p_listings;
CREATE POLICY p2p_listings_update_party_or_admin
ON public.buyer_p2p_listings
FOR UPDATE
TO authenticated
USING (
  (seller_buyer_id IN (SELECT public._current_user_buyer_ids()))
  OR (target_buyer_id IN (SELECT public._current_user_buyer_ids()))
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  (seller_buyer_id IN (SELECT public._current_user_buyer_ids()))
  OR (target_buyer_id IN (SELECT public._current_user_buyer_ids()))
  OR public.is_admin(auth.uid())
);

-- ============================================================
-- 3. restock_transactions: lock financial/status fields from buyer self-updates
-- ============================================================
CREATE OR REPLACE FUNCTION public.restock_transactions_block_buyer_sensitive_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Lock everything sensitive; buyers may only edit delivery notes / billing address
  NEW.final_price          := OLD.final_price;
  NEW.commission_rate      := OLD.commission_rate;
  NEW.status               := OLD.status;
  NEW.penalty_applied      := OLD.penalty_applied;
  NEW.shipping_cost        := OLD.shipping_cost;
  NEW.seller_pickup_address := OLD.seller_pickup_address;
  NEW.buyer_id             := OLD.buyer_id;
  NEW.seller_id            := OLD.seller_id;
  NEW.offer_id             := OLD.offer_id;
  NEW.quantity             := OLD.quantity;
  NEW.unit_price           := OLD.unit_price;
  NEW.paid_at              := OLD.paid_at;
  NEW.released_at          := OLD.released_at;
  NEW.cancelled_at         := OLD.cancelled_at;
  NEW.disputed_at          := OLD.disputed_at;
  NEW.shipped_at           := OLD.shipped_at;
  NEW.delivered_at         := OLD.delivered_at;
  NEW.stripe_payment_intent_id := OLD.stripe_payment_intent_id;
  NEW.invoice_id           := OLD.invoice_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restock_transactions_block_buyer_sensitive_update ON public.restock_transactions;
CREATE TRIGGER trg_restock_transactions_block_buyer_sensitive_update
BEFORE UPDATE ON public.restock_transactions
FOR EACH ROW
EXECUTE FUNCTION public.restock_transactions_block_buyer_sensitive_update();

DROP POLICY IF EXISTS "Buyers update own transactions" ON public.restock_transactions;
CREATE POLICY "Buyers update own transactions"
ON public.restock_transactions
FOR UPDATE
TO authenticated
USING (
  buyer_id IN (SELECT restock_buyers.id FROM public.restock_buyers WHERE restock_buyers.auth_user_id = auth.uid())
)
WITH CHECK (
  buyer_id IN (SELECT restock_buyers.id FROM public.restock_buyers WHERE restock_buyers.auth_user_id = auth.uid())
);
