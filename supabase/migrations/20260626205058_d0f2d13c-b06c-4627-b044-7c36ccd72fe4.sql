
-- 1) Vendor self-UPDATE column guard: block escalation of sensitive fields
CREATE OR REPLACE FUNCTION public.prevent_vendor_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Admins bypass
  SELECT public.is_admin(auth.uid()) INTO v_is_admin;
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Only enforce when the caller is the vendor owner (self-update path)
  IF NEW.auth_user_id IS NULL OR auth.uid() IS NULL OR NEW.auth_user_id <> auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Block changes on sensitive fields
  IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.fixed_commission_amount IS DISTINCT FROM OLD.fixed_commission_amount
     OR NEW.margin_split_pct IS DISTINCT FROM OLD.margin_split_pct
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.validation_status IS DISTINCT FROM OLD.validation_status
     OR NEW.validation_notes IS DISTINCT FROM OLD.validation_notes
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_charges_enabled IS DISTINCT FROM OLD.stripe_charges_enabled
     OR NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled
     OR NEW.stripe_onboarding_complete IS DISTINCT FROM OLD.stripe_onboarding_complete
     OR NEW.qogita_seller_alias IS DISTINCT FROM OLD.qogita_seller_alias
     OR NEW.display_code IS DISTINCT FROM OLD.display_code
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.can_manage_offers IS DISTINCT FROM OLD.can_manage_offers
  THEN
    RAISE EXCEPTION 'Modification of restricted vendor fields requires admin privileges'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_vendor_self_escalation ON public.vendors;
CREATE TRIGGER trg_prevent_vendor_self_escalation
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.prevent_vendor_self_escalation();

-- 2) Add vendor SELECT policy mirroring the UPDATE policy on delegate_callback_requests
DROP POLICY IF EXISTS "Vendor admins read callback requests" ON public.delegate_callback_requests;
CREATE POLICY "Vendor admins read callback requests"
ON public.delegate_callback_requests
FOR SELECT
TO authenticated
USING (public.is_account_admin('vendor'::text, vendor_id));

-- 3) Vendor SELECT on order-pdfs storage bucket for vendors fulfilling orders
DROP POLICY IF EXISTS "Vendors read order pdfs for their orders" ON storage.objects;
CREATE POLICY "Vendors read order pdfs for their orders"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-pdfs'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.order_lines ol ON ol.order_id = o.id
    JOIN public.vendors v ON v.id = ol.vendor_id
    WHERE (o.id)::text = (storage.foldername(storage.objects.name))[1]
      AND v.auth_user_id = auth.uid()
  )
);
