CREATE OR REPLACE FUNCTION public.affiliate_admin_referrals(_affiliate_id uuid)
RETURNS TABLE (
  id uuid, user_id uuid, full_name text, email text, company_name text,
  attributed_at timestamptz, first_order_at timestamptz, window_expires_at timestamptz,
  status text, orders_count int, revenue_ht_cents bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN QUERY
  SELECT r.id, r.user_id, p.full_name, u.email::text, p.company_name,
         r.attributed_at, r.first_order_at, r.window_expires_at, r.status,
         COALESCE(cc.n, 0)::int, COALESCE(cc.ht, 0)::bigint
  FROM public.affiliate_referrals r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  LEFT JOIN auth.users u ON u.id = r.user_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS n, SUM(c.order_total_ht_cents)::bigint AS ht
    FROM public.affiliate_commissions c
    WHERE c.referral_id = r.id AND c.adjustment_of_id IS NULL AND c.status <> 'cancelled') cc ON true
  WHERE r.affiliate_id = _affiliate_id
  ORDER BY r.attributed_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_commissions(_affiliate_id uuid DEFAULT NULL, _status text DEFAULT NULL)
RETURNS TABLE (
  id uuid, affiliate_id uuid, affiliate_code text, affiliate_name text,
  order_id uuid, order_number text, order_date timestamptz,
  client_name text, client_email text,
  order_total_ht_cents int, net_margin_cents int, base_amount_cents int,
  commission_cents int, margin_guard_hit boolean, status text,
  validate_after timestamptz, calc_details jsonb, rule_version int,
  adjustment_of_id uuid, adjustment_of_order_number text, cancelled_reason text,
  invoice_number text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN QUERY
  SELECT c.id, c.affiliate_id, a.affiliate_code, a.display_name,
         c.order_id, o.order_number, o.created_at,
         COALESCE(p.full_name, p.company_name), u.email::text,
         c.order_total_ht_cents, c.net_margin_cents, c.base_amount_cents,
         c.commission_cents, c.margin_guard_hit, c.status,
         c.validate_after, c.calc_details, ru.version,
         c.adjustment_of_id, oo.order_number, c.cancelled_reason,
         pi.invoice_number, c.created_at
  FROM public.affiliate_commissions c
  JOIN public.affiliates a ON a.id = c.affiliate_id
  JOIN public.affiliate_referrals r ON r.id = c.referral_id
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  LEFT JOIN auth.users u ON u.id = r.user_id
  LEFT JOIN public.orders o ON o.id = c.order_id
  LEFT JOIN public.affiliate_commissions ac ON ac.id = c.adjustment_of_id
  LEFT JOIN public.orders oo ON oo.id = ac.order_id
  LEFT JOIN public.affiliate_commission_rules ru ON ru.id = c.rule_id
  LEFT JOIN public.affiliate_payout_invoices pi ON pi.id = c.payout_invoice_id
  WHERE (_affiliate_id IS NULL OR c.affiliate_id = _affiliate_id)
    AND (_status IS NULL OR c.status = _status)
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_rule_history(_scope text DEFAULT 'global', _affiliate_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, scope text, affiliate_id uuid, version int,
  base_rate_bp int, margin_guard_threshold_bp int, margin_rate_bp int,
  attribution_months int, validation_delay_days int, payout_threshold_cents int,
  self_purchase_allowed boolean, monthly_cap_cents int,
  effective_from timestamptz, effective_to timestamptz,
  created_by uuid, created_by_email text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN QUERY
  SELECT r.id, r.scope, r.affiliate_id, r.version,
         r.base_rate_bp, r.margin_guard_threshold_bp, r.margin_rate_bp,
         r.attribution_months, r.validation_delay_days, r.payout_threshold_cents,
         r.self_purchase_allowed, r.monthly_cap_cents,
         r.effective_from, r.effective_to, r.created_by,
         COALESCE(u.email::text, p.full_name), r.created_at
  FROM public.affiliate_commission_rules r
  LEFT JOIN public.profiles p ON p.user_id = r.created_by
  LEFT JOIN auth.users u ON u.id = r.created_by
  WHERE r.scope = _scope
    AND COALESCE(r.affiliate_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(_affiliate_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY r.version DESC;
END;
$$;