
-- Block vendors from self-escalating via sensitive column updates
CREATE OR REPLACE FUNCTION public.vendors_block_self_privesc()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Admins and service_role bypass
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- If caller is the row owner, block sensitive field changes
  IF NEW.auth_user_id = auth.uid() THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.validation_status IS DISTINCT FROM OLD.validation_status
       OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
       OR NEW.commission_model IS DISTINCT FROM OLD.commission_model
       OR NEW.can_manage_offers IS DISTINCT FROM OLD.can_manage_offers
       OR NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled
       OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
       OR NEW.is_manufacturer IS DISTINCT FROM OLD.is_manufacturer
       OR NEW.display_code IS DISTINCT FROM OLD.display_code
       OR NEW.qogita_seller_alias IS DISTINCT FROM OLD.qogita_seller_alias
       OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
    THEN
      RAISE EXCEPTION 'Vendors cannot modify privileged columns (admin-only)';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vendors_block_self_privesc ON public.vendors;
CREATE TRIGGER trg_vendors_block_self_privesc
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.vendors_block_self_privesc();

-- Block buyer_p2p_listings parties from changing financial/state fields they shouldn't
CREATE OR REPLACE FUNCTION public.buyer_p2p_listings_party_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_seller boolean := false;
  is_target boolean := false;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  is_seller := OLD.seller_buyer_id IN (SELECT _current_user_buyer_ids());
  is_target := OLD.target_buyer_id IS NOT NULL AND OLD.target_buyer_id IN (SELECT _current_user_buyer_ids());

  -- Target buyer: may only update acceptance-related fields (status to accepted/declined)
  IF is_target AND NOT is_seller THEN
    IF NEW.unit_price_excl_vat_cents IS DISTINCT FROM OLD.unit_price_excl_vat_cents
       OR NEW.commission_rate_bps IS DISTINCT FROM OLD.commission_rate_bps
       OR NEW.commission_enabled IS DISTINCT FROM OLD.commission_enabled
       OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
       OR NEW.seller_buyer_id IS DISTINCT FROM OLD.seller_buyer_id
       OR NEW.target_buyer_id IS DISTINCT FROM OLD.target_buyer_id
    THEN
      RAISE EXCEPTION 'Target buyer cannot modify pricing/commission/validity fields';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('accepted','declined','cancelled') THEN
      RAISE EXCEPTION 'Target buyer can only accept/decline/cancel';
    END IF;
  END IF;

  -- Seller cannot reassign parties
  IF is_seller THEN
    IF NEW.seller_buyer_id IS DISTINCT FROM OLD.seller_buyer_id
       OR NEW.target_buyer_id IS DISTINCT FROM OLD.target_buyer_id
    THEN
      RAISE EXCEPTION 'Seller cannot reassign listing parties';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_buyer_p2p_listings_party_columns ON public.buyer_p2p_listings;
CREATE TRIGGER trg_buyer_p2p_listings_party_columns
BEFORE UPDATE ON public.buyer_p2p_listings
FOR EACH ROW EXECUTE FUNCTION public.buyer_p2p_listings_party_columns();

-- Block buyers from manipulating restock_transactions financials/status
CREATE OR REPLACE FUNCTION public.restock_transactions_buyer_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_buyer boolean := false;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  is_buyer := EXISTS(
    SELECT 1 FROM public.restock_buyers rb
    WHERE rb.id = OLD.buyer_id AND rb.auth_user_id = auth.uid()
  );
  IF is_buyer THEN
    IF NEW.final_price IS DISTINCT FROM OLD.final_price
       OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.penalty_applied IS DISTINCT FROM OLD.penalty_applied
       OR NEW.shipping_cost IS DISTINCT FROM OLD.shipping_cost
       OR NEW.seller_pickup_address IS DISTINCT FROM OLD.seller_pickup_address
       OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
       OR NEW.offer_id IS DISTINCT FROM OLD.offer_id
    THEN
      RAISE EXCEPTION 'Buyers cannot modify financial/status fields on restock transactions';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_restock_transactions_buyer_columns ON public.restock_transactions;
CREATE TRIGGER trg_restock_transactions_buyer_columns
BEFORE UPDATE ON public.restock_transactions
FOR EACH ROW EXECUTE FUNCTION public.restock_transactions_buyer_columns();
