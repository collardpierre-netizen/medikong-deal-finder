
-- 1) delegate_callback_requests: limit vendor reads/updates to vendor account admins
DROP POLICY IF EXISTS "Vendor reads own callback requests" ON public.delegate_callback_requests;
DROP POLICY IF EXISTS "Vendor updates own callback requests" ON public.delegate_callback_requests;

CREATE POLICY "Vendor admins read callback requests"
ON public.delegate_callback_requests
FOR SELECT
TO authenticated
USING (public.is_account_admin('vendor', vendor_id));

CREATE POLICY "Vendor admins update callback requests"
ON public.delegate_callback_requests
FOR UPDATE
TO authenticated
USING (public.is_account_admin('vendor', vendor_id))
WITH CHECK (public.is_account_admin('vendor', vendor_id));

-- 2) market_prices: restrict to verified buyers / admins
DROP POLICY IF EXISTS "authenticated_read_market_prices" ON public.market_prices;
CREATE POLICY "verified_read_market_prices"
ON public.market_prices
FOR SELECT
TO authenticated
USING (public.is_verified_buyer_or_admin(auth.uid()));

-- 3) offer_margin_snapshots: remove vendor read (admin only)
DROP POLICY IF EXISTS "Vendors read own margin snapshots" ON public.offer_margin_snapshots;

-- 4) offers: revoke internal cost/margin/commission columns from anon + authenticated
REVOKE SELECT (
  purchase_price,
  purchase_price_excl_vat,
  margin_amount,
  applied_margin_percentage,
  applied_margin_rule_id,
  qogita_base_price,
  commission_model,
  commission_rate,
  margin_split_pct,
  fixed_commission_amount
) ON public.offers FROM anon, authenticated;

GRANT SELECT (
  purchase_price,
  purchase_price_excl_vat,
  margin_amount,
  applied_margin_percentage,
  applied_margin_rule_id,
  qogita_base_price,
  commission_model,
  commission_rate,
  margin_split_pct,
  fixed_commission_amount
) ON public.offers TO service_role;

-- 5) restock_transactions: revoke pickup security tokens from public/authenticated (keep service_role/admin)
REVOKE SELECT (pickup_qr_token, pickup_handover_code) ON public.restock_transactions FROM anon, authenticated, public;
GRANT SELECT (pickup_qr_token, pickup_handover_code) ON public.restock_transactions TO service_role;

-- 6) vendors: revoke banking/financial/internal columns from authenticated
REVOKE SELECT (
  iban,
  bic,
  bank_name,
  stripe_account_id,
  commission_rate,
  margin_split_pct,
  fixed_commission_amount,
  qogita_seller_alias
) ON public.vendors FROM anon, authenticated;

GRANT SELECT (
  iban,
  bic,
  bank_name,
  stripe_account_id,
  commission_rate,
  margin_split_pct,
  fixed_commission_amount,
  qogita_seller_alias
) ON public.vendors TO service_role;

-- 6b) vendors: block self-modification of sensitive financial/validation fields
CREATE OR REPLACE FUNCTION public.prevent_vendor_self_sensitive_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  -- Skip checks for service role and platform admins
  IF auth.role() = 'service_role' OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Allow vendor account admins to modify business fields, but never platform-controlled fields
  IF NEW.validation_status IS DISTINCT FROM OLD.validation_status
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.margin_split_pct IS DISTINCT FROM OLD.margin_split_pct
     OR NEW.fixed_commission_amount IS DISTINCT FROM OLD.fixed_commission_amount
     OR NEW.qogita_seller_alias IS DISTINCT FROM OLD.qogita_seller_alias
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
  THEN
    RAISE EXCEPTION 'Modification of platform-controlled vendor fields requires admin privileges';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_vendor_self_sensitive_update ON public.vendors;
CREATE TRIGGER trg_prevent_vendor_self_sensitive_update
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.prevent_vendor_self_sensitive_update();
