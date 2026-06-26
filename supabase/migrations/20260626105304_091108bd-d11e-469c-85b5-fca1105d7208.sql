
-- 1) Vendors: block self-privilege escalation
CREATE OR REPLACE FUNCTION public.vendors_block_self_privesc()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.validation_status IS DISTINCT FROM OLD.validation_status
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.commission_model IS DISTINCT FROM OLD.commission_model
     OR NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled
     OR NEW.stripe_charges_enabled IS DISTINCT FROM OLD.stripe_charges_enabled
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.can_manage_offers IS DISTINCT FROM OLD.can_manage_offers
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
    RAISE EXCEPTION 'Forbidden: only admins can change sensitive vendor fields';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vendors_block_self_privesc ON public.vendors;
CREATE TRIGGER vendors_block_self_privesc
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.vendors_block_self_privesc();

-- 2) buyer_p2p_listings: restrict mutable columns per party
CREATE OR REPLACE FUNCTION public.buyer_p2p_listings_party_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  buyer_ids uuid[];
  is_seller boolean := false;
  is_target boolean := false;
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  SELECT array_agg(x) INTO buyer_ids FROM public._current_user_buyer_ids() AS x;
  is_seller := OLD.seller_buyer_id = ANY(buyer_ids);
  is_target := OLD.target_buyer_id = ANY(buyer_ids);

  -- Target buyer: may only respond (status to accepted/declined). Cannot touch financials.
  IF is_target AND NOT is_seller THEN
    IF NEW.unit_price_excl_vat_cents IS DISTINCT FROM OLD.unit_price_excl_vat_cents
       OR NEW.commission_rate_bps IS DISTINCT FROM OLD.commission_rate_bps
       OR NEW.commission_enabled IS DISTINCT FROM OLD.commission_enabled
       OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
       OR NEW.quantity IS DISTINCT FROM OLD.quantity
       OR NEW.vat_rate IS DISTINCT FROM OLD.vat_rate
       OR NEW.seller_buyer_id IS DISTINCT FROM OLD.seller_buyer_id
       OR NEW.target_buyer_id IS DISTINCT FROM OLD.target_buyer_id THEN
      RAISE EXCEPTION 'Forbidden: target buyer cannot modify pricing or scope';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('accepted','declined') THEN
      RAISE EXCEPTION 'Forbidden: target buyer can only accept or decline';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS buyer_p2p_listings_party_columns ON public.buyer_p2p_listings;
CREATE TRIGGER buyer_p2p_listings_party_columns
BEFORE UPDATE ON public.buyer_p2p_listings
FOR EACH ROW EXECUTE FUNCTION public.buyer_p2p_listings_party_columns();

-- 3) restock_transactions: lock financial/status columns from buyer
CREATE OR REPLACE FUNCTION public.restock_transactions_buyer_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- If caller is buyer (RLS already gates this), block sensitive fields
  IF EXISTS (
    SELECT 1 FROM public.restock_buyers
    WHERE id = OLD.buyer_id AND auth_user_id = auth.uid()
  ) THEN
    IF NEW.final_price IS DISTINCT FROM OLD.final_price
       OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.penalty_applied IS DISTINCT FROM OLD.penalty_applied
       OR NEW.shipping_cost IS DISTINCT FROM OLD.shipping_cost
       OR NEW.seller_pickup_address IS DISTINCT FROM OLD.seller_pickup_address
       OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
       OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
       OR NEW.offer_id IS DISTINCT FROM OLD.offer_id THEN
      RAISE EXCEPTION 'Forbidden: buyers cannot modify transaction financials or status';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS restock_transactions_buyer_columns ON public.restock_transactions;
CREATE TRIGGER restock_transactions_buyer_columns
BEFORE UPDATE ON public.restock_transactions
FOR EACH ROW EXECUTE FUNCTION public.restock_transactions_buyer_columns();
