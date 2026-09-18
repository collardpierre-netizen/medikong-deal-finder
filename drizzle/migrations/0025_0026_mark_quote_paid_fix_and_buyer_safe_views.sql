-- 1) mark_quote_paid: l'appel à convert_quote_to_order(_quote_id) est ambigu
--    depuis la création de la surcharge (uuid, boolean). On qualifie l'appel.
CREATE OR REPLACE FUNCTION public.mark_quote_paid(_quote_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_conv jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','not_found');
  END IF;
  IF v_quote.status NOT IN ('accepted','sent') THEN
    RETURN jsonb_build_object('error','invalid_status','status', v_quote.status::text);
  END IF;

  UPDATE public.quotes
  SET status = 'paid', paid_at = now(),
      accepted_at = COALESCE(accepted_at, now())
  WHERE id = _quote_id;

  v_conv := public.convert_quote_to_order(_quote_id, false);
  RETURN jsonb_build_object('ok', true, 'order_id', v_conv->>'order_id');
END;
$function$;

-- 2) Fuite coûts/marges vendeur vers l'acheteur sur order_lines :
--    la policy acheteur donnait accès à toute la ligne. On la remplace par
--    une vue acheteur ne contenant que les colonnes non sensibles.
DROP POLICY IF EXISTS "Customers read own order lines safe" ON public.order_lines;

CREATE OR REPLACE VIEW public.buyer_order_lines_v AS
SELECT
  ol.id, ol.order_id, ol.product_id, ol.offer_id, ol.vendor_id,
  ol.quantity, ol.quantity_shipped,
  ol.unit_price_excl_vat, ol.unit_price_incl_vat, ol.vat_rate,
  ol.line_total_excl_vat, ol.line_total_incl_vat,
  ol.manual_label, ol.vendor_reference,
  ol.fulfillment_type, ol.fulfillment_status,
  ol.tracking_number, ol.tracking_url,
  ol.cancellation_reason, ol.cancelled_at,
  ol.refunded_amount_incl_vat,
  ol.buyer_confirmation_status, ol.buyer_confirmed_at,
  ol.buyer_confirmed_quantity, ol.buyer_confirmation_note,
  ol.buyer_confirmation_source,
  ol.backorder_status, ol.backorder_note, ol.backorder_updated_at,
  ol.stripe_payment_intent_id,
  ol.updated_at
FROM public.order_lines ol
WHERE public.is_customer_order(ol.order_id);

REVOKE ALL ON public.buyer_order_lines_v FROM anon;
GRANT SELECT ON public.buyer_order_lines_v TO authenticated;

-- 3) Même problème sur restock_shipments (coût Sendcloud + marge MediKong).
DROP POLICY IF EXISTS "Buyers view own shipments" ON public.restock_shipments;

CREATE OR REPLACE VIEW public.buyer_restock_shipments_v AS
SELECT
  s.id, s.transaction_id, s.buyer_id, s.seller_id,
  s.status, s.status_updated_at, s.exception_reason,
  s.sendcloud_tracking_number, s.sendcloud_tracking_url, s.sendcloud_label_url,
  s.carrier, s.weight_g,
  s.buyer_shipping_fee_cents,
  s.created_at
FROM public.restock_shipments s
WHERE s.buyer_id IN (
  SELECT rb.id FROM public.restock_buyers rb WHERE rb.auth_user_id = auth.uid()
);

REVOKE ALL ON public.buyer_restock_shipments_v FROM anon;
GRANT SELECT ON public.buyer_restock_shipments_v TO authenticated;