DROP POLICY IF EXISTS "Vendors read orders with their lines" ON public.orders;

CREATE OR REPLACE VIEW public.vendor_orders_v
WITH (security_invoker = false) AS
SELECT id, order_number, customer_id, source, api_key_id, status, subtotal_excl_vat, vat_amount, total_incl_vat, shipping_address, billing_address, estimated_delivery_date, payment_method, payment_status, payment_due_date, notes, created_at, updated_at, stripe_payment_intent_id, stripe_session_id, is_test, hidden_from_list, deleted_at, deleted_by, deleted_reason, created_by_admin, draft_payload, is_forecast, was_forecast, forecast_created_at, forecast_converted_at, forecast_snapshot, public_token, shipping_address_id, fulfillment_mode, customer_validated_at, customer_validation_email, draft_fingerprint, show_payment_info, tracking_url, tracking_carrier, tracking_number, shipped_at, delivery_confirmation_requested_at, delivery_confirmation_completed_at, cagnotte_eligible_ht, cagnotte_earned, cagnotte_used, email_cagnotte_earned_sent_at, cagnotte_restituted_at
FROM public.orders o
WHERE public.is_order_vendor(o.id) OR public.is_admin(auth.uid());

REVOKE ALL ON public.vendor_orders_v FROM anon;
GRANT SELECT ON public.vendor_orders_v TO authenticated;
GRANT ALL ON public.vendor_orders_v TO service_role;