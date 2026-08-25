-- 1) Profiles : bloquer aussi l'auto-attribution du statut fondateur
CREATE OR REPLACE FUNCTION public._guard_profiles_privileged_cols()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public._is_admin_or_service() THEN
    RETURN NEW;
  END IF;
  IF NEW.price_level_code IS DISTINCT FROM OLD.price_level_code
     OR NEW.buyer_profile_id IS DISTINCT FROM OLD.buyer_profile_id
     OR NEW.is_founder IS DISTINCT FROM OLD.is_founder
     OR NEW.founder_since IS DISTINCT FROM OLD.founder_since
     OR NEW.founder_source IS DISTINCT FROM OLD.founder_source
  THEN
    RAISE EXCEPTION 'Not allowed to modify price level, buyer profile or founder status' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) ReStock : neutraliser aussi la modification de la commission, du séquestre et des références de facturation
CREATE OR REPLACE FUNCTION public.restock_transactions_block_buyer_sensitive_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Lock everything sensitive; buyers may only edit delivery notes / billing address
  NEW.final_price          := OLD.final_price;
  NEW.commission_rate      := OLD.commission_rate;
  NEW.commission_amount    := OLD.commission_amount;
  NEW.escrow_released_at   := OLD.escrow_released_at;
  NEW.invoice_buyer_id     := OLD.invoice_buyer_id;
  NEW.invoice_seller_id    := OLD.invoice_seller_id;
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
$function$;