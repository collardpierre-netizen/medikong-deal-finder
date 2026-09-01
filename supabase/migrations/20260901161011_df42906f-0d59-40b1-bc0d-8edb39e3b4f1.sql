DROP FUNCTION IF EXISTS public.affiliate_process_order_commission(uuid);

CREATE OR REPLACE FUNCTION public.affiliate_process_order_commission(_order_id uuid, _allow_unpaid boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order    public.orders%ROWTYPE;
  v_user     uuid;
  v_ref      public.affiliate_referrals%ROWTYPE;
  v_aff      public.affiliates%ROWTYPE;
  v_rule     public.affiliate_commission_rules%ROWTYPE;
  v_paid_at  timestamptz;
  v_total    int;
  v_margin   int;
  v_calc     jsonb;
  v_status   text;
  v_existing uuid;
  v_unpaid   boolean := false;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  IF v_order.payment_status <> 'paid' THEN
    IF _allow_unpaid AND v_order.status::text IN ('confirmed','processing','partially_shipped','shipped','delivered') THEN
      v_unpaid := true;
    ELSE
      RETURN jsonb_build_object('ok', false, 'reason', 'order_not_paid');
    END IF;
  END IF;

  SELECT id INTO v_existing FROM public.affiliate_commissions
   WHERE order_id = _order_id AND adjustment_of_id IS NULL;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'already_computed', 'commission_id', v_existing);
  END IF;

  SELECT c.auth_user_id INTO v_user FROM public.customers c WHERE c.id = v_order.customer_id;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_auth_user');
  END IF;

  SELECT * INTO v_ref FROM public.affiliate_referrals WHERE user_id = v_user;
  IF NOT FOUND OR v_ref.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_referral');
  END IF;

  SELECT * INTO v_aff FROM public.affiliates WHERE id = v_ref.affiliate_id;
  IF v_aff.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'affiliate_not_active');
  END IF;

  v_rule := public.affiliate_resolve_rule(v_ref.affiliate_id);
  IF v_rule.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_rule');
  END IF;

  IF NOT v_rule.self_purchase_allowed AND v_aff.user_id IS NOT NULL AND v_aff.user_id = v_user THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_purchase_blocked');
  END IF;

  v_paid_at := COALESCE(v_order.updated_at, v_order.created_at, now());

  IF v_ref.first_order_at IS NULL THEN
    UPDATE public.affiliate_referrals
       SET first_order_at = v_paid_at,
           window_expires_at = v_paid_at + (v_rule.attribution_months || ' months')::interval,
           status = 'converted'
     WHERE id = v_ref.id
     RETURNING * INTO v_ref;
  END IF;

  IF v_ref.window_expires_at IS NOT NULL AND v_paid_at > v_ref.window_expires_at THEN
    UPDATE public.affiliate_referrals SET status = 'expired' WHERE id = v_ref.id AND status <> 'expired';
    RETURN jsonb_build_object('ok', false, 'reason', 'attribution_window_expired');
  END IF;

  v_total := ROUND(COALESCE(v_order.subtotal_excl_vat, 0) * 100)::int;
  v_margin := public.affiliate_compute_order_net_margin_cents(_order_id);

  v_calc := public.affiliate_calc_commission(
    v_total, v_margin, v_rule.base_rate_bp, v_rule.margin_guard_threshold_bp, v_rule.margin_rate_bp);

  v_status := CASE
    WHEN v_unpaid THEN 'on_hold'
    WHEN (v_calc->>'computable')::boolean THEN 'pending'
    ELSE 'on_hold' END;

  INSERT INTO public.affiliate_commissions (
    affiliate_id, referral_id, order_id, rule_id,
    order_total_ht_cents, net_margin_cents, base_amount_cents,
    margin_guard_hit, commission_cents, calc_details, status, validate_after)
  VALUES (
    v_ref.affiliate_id, v_ref.id, _order_id, v_rule.id,
    v_total, v_margin, (v_calc->>'base_amount_cents')::int,
    COALESCE((v_calc->>'margin_guard_hit')::boolean, false),
    COALESCE((v_calc->>'commission_cents')::int, 0),
    v_calc || jsonb_build_object('rule_version', v_rule.version, 'paid_at', v_paid_at,
                                 'awaiting_payment', v_unpaid, 'backfilled', _allow_unpaid),
    v_status,
    v_paid_at + (v_rule.validation_delay_days || ' days')::interval)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_existing;

  RETURN jsonb_build_object('ok', true, 'commission_id', v_existing, 'status', v_status,
                            'awaiting_payment', v_unpaid, 'calc', v_calc);
END;
$function$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_backfill_orders(
  _affiliate_id uuid,
  _customer_id uuid DEFAULT NULL,
  _include_unpaid boolean DEFAULT true
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_res jsonb;
  v_created int := 0;
  v_skipped int := 0;
  v_on_hold int := 0;
  v_total_cents bigint := 0;
  v_reasons jsonb := '{}'::jsonb;
  v_reason text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;

  FOR v_order IN
    SELECT o.id
      FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      JOIN public.affiliate_referrals r ON r.user_id = c.auth_user_id
     WHERE r.affiliate_id = _affiliate_id
       AND r.status <> 'revoked'
       AND (_customer_id IS NULL OR o.customer_id = _customer_id)
       AND o.status::text NOT IN ('draft','cancelled','error')
     ORDER BY COALESCE(o.updated_at, o.created_at) ASC
  LOOP
    v_res := public.affiliate_process_order_commission(v_order.id, _include_unpaid);
    IF (v_res->>'ok')::boolean AND (v_res->>'skipped') IS NULL THEN
      v_created := v_created + 1;
      IF v_res->>'status' = 'on_hold' THEN v_on_hold := v_on_hold + 1; END IF;
      v_total_cents := v_total_cents + COALESCE((v_res->'calc'->>'commission_cents')::bigint, 0);
    ELSE
      v_skipped := v_skipped + 1;
      v_reason := COALESCE(v_res->>'reason', v_res->>'skipped', 'unknown');
      v_reasons := jsonb_set(v_reasons, ARRAY[v_reason],
                             to_jsonb(COALESCE((v_reasons->>v_reason)::int, 0) + 1), true);
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'affiliate_backfill_orders', 'affiliate', _affiliate_id,
          jsonb_build_object('customer_id', _customer_id, 'include_unpaid', _include_unpaid,
                             'commissions_created', v_created, 'orders_skipped', v_skipped));

  RETURN jsonb_build_object('ok', true, 'commissions_created', v_created,
                            'on_hold', v_on_hold, 'orders_skipped', v_skipped,
                            'commission_total_cents', v_total_cents, 'skip_reasons', v_reasons);
END;
$function$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_attach_customer(_affiliate_id uuid, _customer_id uuid, _recompute_past_orders boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_ref public.affiliate_referrals%ROWTYPE;
  v_back jsonb := NULL;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;

  SELECT c.auth_user_id INTO v_user FROM public.customers c WHERE c.id = _customer_id;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'customer_without_account');
  END IF;

  SELECT * INTO v_ref FROM public.affiliate_referrals WHERE user_id = v_user AND status <> 'revoked' LIMIT 1;
  IF v_ref.id IS NOT NULL THEN
    IF v_ref.affiliate_id <> _affiliate_id THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_attributed_to_other_affiliate');
    END IF;
  ELSE
    INSERT INTO public.affiliate_referrals (affiliate_id, user_id, status)
    VALUES (_affiliate_id, v_user, 'attributed')
    RETURNING * INTO v_ref;
  END IF;

  IF _recompute_past_orders THEN
    v_back := public.affiliate_admin_backfill_orders(_affiliate_id, _customer_id, true);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'affiliate_attach_customer', 'affiliate', _affiliate_id,
          jsonb_build_object('customer_id', _customer_id, 'referral_id', v_ref.id, 'backfill', v_back));

  RETURN jsonb_build_object('ok', true, 'referral_id', v_ref.id,
                            'commissions_created', COALESCE((v_back->>'commissions_created')::int, 0),
                            'orders_skipped', COALESCE((v_back->>'orders_skipped')::int, 0),
                            'backfill', v_back);
END;
$function$;

REVOKE ALL ON FUNCTION public.affiliate_admin_backfill_orders(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_backfill_orders(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_process_order_commission(uuid, boolean) TO authenticated, service_role;