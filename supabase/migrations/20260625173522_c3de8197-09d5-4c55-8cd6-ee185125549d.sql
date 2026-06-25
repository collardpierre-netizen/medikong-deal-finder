
DROP POLICY IF EXISTS vendors_members_select ON public.vendors;
CREATE POLICY vendors_owner_select ON public.vendors
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Vendor admins read callback requests" ON public.delegate_callback_requests;

CREATE OR REPLACE VIEW public.restock_transactions_seller_v
WITH (security_invoker = true) AS
SELECT
  id, seller_id, buyer_id, offer_id, status, created_at, updated_at,
  final_price, quantity, shipping_cost, commission_rate, commission_amount,
  delivery_mode, tracking_number, tracking_url, sendcloud_parcel_id,
  paid_at, delivered_at, pickup_deadline_at, pickup_confirmed_at,
  pickup_confirmed_by, pickup_confirmation_method,
  seller_pickup_address, seller_pickup_city, seller_pickup_phone, seller_pickup_instructions,
  buyer_name, buyer_company, buyer_street, buyer_city, buyer_postal_code, buyer_country,
  delivery_notes, billing_same_as_shipping,
  dispute_reason, penalty_applied, escrow_released_at,
  invoice_buyer_id, invoice_seller_id, cancelled_reason
FROM public.restock_transactions
WHERE seller_id = auth.uid();

GRANT SELECT ON public.restock_transactions_seller_v TO authenticated;

REVOKE SELECT (buyer_email, buyer_vat_number, buyer_phone, pickup_handover_code, pickup_qr_token)
  ON public.restock_transactions FROM authenticated, anon;

REVOKE SELECT (public_token, public_access_pin) ON public.orders FROM authenticated, anon;
REVOKE SELECT (public_token) ON public.quotes FROM authenticated, anon;
