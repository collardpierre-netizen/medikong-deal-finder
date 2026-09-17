-- Lot 0016
-- 1) Repli commission : si orders.commission_total_ht est nul/0 et qu'aucune ligne
--    order_items ne porte commission_ht, on lit les overrides de sub_orders.
-- 2) Frais de paiement : appliqués uniquement aux commandes réellement payées par carte
--    (Stripe). Les virements / factures n'engendrent pas de frais d'acquisition carte.
CREATE OR REPLACE FUNCTION public.affiliate_compute_order_net_margin_cents(_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_commission numeric;
  v_total_incl numeric;
  v_cagnotte   numeric;
  v_method     text;
  v_fee_bp     int;
  v_fee_fixed  int;
  v_deduct_cag boolean;
  v_fees       numeric := 0;
BEGIN
  SELECT o.commission_total_ht, o.total_incl_vat, COALESCE(o.cagnotte_used, 0), o.payment_method::text
    INTO v_commission, v_total_incl, v_cagnotte, v_method
  FROM public.orders o WHERE o.id = _order_id;

  IF COALESCE(v_commission, 0) = 0 THEN
    SELECT SUM(oi.commission_ht) INTO v_commission
    FROM public.order_items oi WHERE oi.order_id = _order_id;
  END IF;

  IF COALESCE(v_commission, 0) = 0 THEN
    SELECT SUM(so.commission_amount_override) INTO v_commission
    FROM public.sub_orders so
    WHERE so.order_id = _order_id AND so.commission_amount_override IS NOT NULL;
  END IF;

  IF v_commission IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT payment_fee_bp, payment_fee_fixed_cents, deduct_cagnotte
    INTO v_fee_bp, v_fee_fixed, v_deduct_cag
  FROM public.affiliate_margin_cost_params
  WHERE effective_to IS NULL
  ORDER BY effective_from DESC LIMIT 1;

  v_fee_bp := COALESCE(v_fee_bp, 180);
  v_fee_fixed := COALESCE(v_fee_fixed, 25);

  IF COALESCE(v_method, '') IN ('card', 'stripe', 'credit_card') THEN
    v_fees := ROUND(COALESCE(v_total_incl, 0) * 100 * v_fee_bp / 10000.0) + v_fee_fixed;
  END IF;

  RETURN ROUND(v_commission * 100)::int
         - v_fees::int
         - CASE WHEN COALESCE(v_deduct_cag, true) THEN ROUND(v_cagnotte * 100)::int ELSE 0 END;
END;
$function$;