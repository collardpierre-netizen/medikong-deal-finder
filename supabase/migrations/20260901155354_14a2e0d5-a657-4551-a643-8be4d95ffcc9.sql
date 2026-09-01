CREATE OR REPLACE FUNCTION public.affiliate_admin_attachable_customers(_q text DEFAULT NULL)
RETURNS TABLE(customer_id uuid, auth_user_id uuid, label text, email text, company_name text, orders_count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN QUERY
  SELECT c.id,
         c.auth_user_id,
         COALESCE(NULLIF(c.company_name, ''), NULLIF(c.contact_name, ''), c.email, c.id::text)::text,
         c.email::text,
         c.company_name::text,
         (SELECT COUNT(*)::int FROM public.orders o WHERE o.customer_id = c.id)
  FROM public.customers c
  WHERE c.auth_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.affiliate_referrals r
      WHERE r.user_id = c.auth_user_id AND r.status <> 'revoked')
    AND (_q IS NULL OR _q = '' OR
         c.company_name ILIKE '%' || _q || '%' OR
         c.contact_name ILIKE '%' || _q || '%' OR
         c.email ILIKE '%' || _q || '%')
  ORDER BY 3
  LIMIT 50;
END;
$function$;

REVOKE ALL ON FUNCTION public.affiliate_admin_attachable_customers(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_attachable_customers(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.affiliate_admin_attach_customer(
  _affiliate_id uuid,
  _customer_id uuid,
  _recompute_past_orders boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_ref public.affiliate_referrals%ROWTYPE;
  v_order record;
  v_res jsonb;
  v_created int := 0;
  v_skipped int := 0;
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
    FOR v_order IN
      SELECT o.id FROM public.orders o
      WHERE o.customer_id = _customer_id AND o.payment_status = 'paid'
      ORDER BY COALESCE(o.updated_at, o.created_at) ASC
    LOOP
      v_res := public.affiliate_process_order_commission(v_order.id);
      IF (v_res->>'ok')::boolean AND (v_res->>'skipped') IS NULL THEN
        v_created := v_created + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'affiliate_attach_customer', 'affiliate', _affiliate_id,
          jsonb_build_object('customer_id', _customer_id, 'referral_id', v_ref.id,
                             'commissions_created', v_created, 'orders_skipped', v_skipped));

  RETURN jsonb_build_object('ok', true, 'referral_id', v_ref.id,
                            'commissions_created', v_created, 'orders_skipped', v_skipped);
END;
$function$;

REVOKE ALL ON FUNCTION public.affiliate_admin_attach_customer(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_attach_customer(uuid, uuid, boolean) TO authenticated;