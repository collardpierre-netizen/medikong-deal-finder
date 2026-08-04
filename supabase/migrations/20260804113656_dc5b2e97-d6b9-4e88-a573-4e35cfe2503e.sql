-- === Apporteurs d'affaires · Lot 2 : extensions RPC (aucune nouvelle table) ===

-- 0. Les campagnes "affiliate" appartiennent à leur apporteur
CREATE OR REPLACE FUNCTION public.user_owns_tracking_campaign(_owner_type text, _owner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _owner_type = 'vendor' AND _owner_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.vendors v WHERE v.id = _owner_id AND v.auth_user_id = auth.uid()
    )
    WHEN _owner_type = 'affiliate' AND _owner_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.affiliates a WHERE a.id = _owner_id AND a.user_id = auth.uid()
    )
    ELSE false
  END;
$$;

-- Helper : cible d'une RPC portail (soi-même, ou un apporteur si admin "voir comme")
CREATE OR REPLACE FUNCTION public.affiliate_target_id(_affiliate_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  IF _affiliate_id IS NOT NULL AND public.is_admin() THEN
    RETURN _affiliate_id;
  END IF;
  v := public.current_affiliate_id();
  IF v IS NULL THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN v;
END;
$$;

-- 1. RPC portail : ajout du paramètre optionnel _affiliate_id (admin only)
DROP FUNCTION IF EXISTS public.affiliate_current_rule();
CREATE OR REPLACE FUNCTION public.affiliate_current_rule(_affiliate_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid; v_rule public.affiliate_commission_rules%ROWTYPE;
BEGIN
  v_aff := public.affiliate_target_id(_affiliate_id);
  v_rule := public.affiliate_resolve_rule(v_aff);
  RETURN jsonb_build_object(
    'base_rate_bp', v_rule.base_rate_bp,
    'margin_guard_threshold_bp', v_rule.margin_guard_threshold_bp,
    'margin_rate_bp', v_rule.margin_rate_bp,
    'attribution_months', v_rule.attribution_months,
    'validation_delay_days', v_rule.validation_delay_days,
    'payout_threshold_cents', v_rule.payout_threshold_cents,
    'self_purchase_allowed', v_rule.self_purchase_allowed,
    'monthly_cap_cents', v_rule.monthly_cap_cents,
    'scope', v_rule.scope, 'version', v_rule.version, 'rule_id', v_rule.id);
END;
$$;

DROP FUNCTION IF EXISTS public.affiliate_my_referrals();
CREATE OR REPLACE FUNCTION public.affiliate_my_referrals(_affiliate_id uuid DEFAULT NULL)
RETURNS TABLE (
  pseudo text, attributed_at timestamptz, first_order_at timestamptz,
  window_expires_at timestamptz, status text, orders_count int, revenue_ht_cents bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid;
BEGIN
  v_aff := public.affiliate_target_id(_affiliate_id);
  RETURN QUERY
  SELECT 'Client #' || upper(substr(md5(r.user_id::text || r.affiliate_id::text), 1, 4)),
         r.attributed_at, r.first_order_at, r.window_expires_at, r.status,
         COALESCE(cc.n, 0)::int, COALESCE(cc.ht, 0)::bigint
  FROM public.affiliate_referrals r
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS n, SUM(c.order_total_ht_cents)::bigint AS ht
    FROM public.affiliate_commissions c
    WHERE c.referral_id = r.id AND c.adjustment_of_id IS NULL AND c.status <> 'cancelled') cc ON true
  WHERE r.affiliate_id = v_aff
  ORDER BY r.attributed_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.affiliate_my_commissions();
CREATE OR REPLACE FUNCTION public.affiliate_my_commissions(_affiliate_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, order_id uuid, order_number text, order_date timestamptz, pseudo text,
  order_total_ht_cents int, commission_cents int, margin_guard_hit boolean,
  status text, validate_after timestamptz, calc_details jsonb, invoice_number text,
  adjustment_of_id uuid, cancelled_reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid;
BEGIN
  v_aff := public.affiliate_target_id(_affiliate_id);
  RETURN QUERY
  SELECT c.id, c.order_id, o.order_number, o.created_at,
         'Client #' || upper(substr(md5(r.user_id::text || r.affiliate_id::text), 1, 4)),
         c.order_total_ht_cents, c.commission_cents, c.margin_guard_hit,
         c.status, c.validate_after, c.calc_details, pi.invoice_number,
         c.adjustment_of_id, c.cancelled_reason
  FROM public.affiliate_commissions c
  JOIN public.affiliate_referrals r ON r.id = c.referral_id
  LEFT JOIN public.orders o ON o.id = c.order_id
  LEFT JOIN public.affiliate_payout_invoices pi ON pi.id = c.payout_invoice_id
  WHERE c.affiliate_id = v_aff
  ORDER BY o.created_at DESC NULLS LAST;
END;
$$;

DROP FUNCTION IF EXISTS public.affiliate_dashboard_stats();
CREATE OR REPLACE FUNCTION public.affiliate_dashboard_stats(_affiliate_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid; v_res jsonb;
BEGIN
  v_aff := public.affiliate_target_id(_affiliate_id);
  SELECT jsonb_build_object(
    'referrals_total', (SELECT COUNT(*) FROM public.affiliate_referrals WHERE affiliate_id = v_aff),
    'referrals_active', (SELECT COUNT(*) FROM public.affiliate_referrals
                          WHERE affiliate_id = v_aff AND status = 'converted'
                            AND (window_expires_at IS NULL OR window_expires_at > now())),
    'orders_count', (SELECT COUNT(*) FROM public.affiliate_commissions
                      WHERE affiliate_id = v_aff AND adjustment_of_id IS NULL AND status <> 'cancelled'),
    'revenue_ht_cents', (SELECT COALESCE(SUM(order_total_ht_cents), 0) FROM public.affiliate_commissions
                          WHERE affiliate_id = v_aff AND adjustment_of_id IS NULL AND status <> 'cancelled'),
    'avg_basket_ht_cents', (SELECT COALESCE(ROUND(AVG(order_total_ht_cents)), 0) FROM public.affiliate_commissions
                             WHERE affiliate_id = v_aff AND adjustment_of_id IS NULL AND status <> 'cancelled'),
    'commissions_pending_cents', (SELECT COALESCE(SUM(commission_cents), 0) FROM public.affiliate_commissions
                                   WHERE affiliate_id = v_aff AND status IN ('pending','on_hold')),
    'commissions_validated_cents', (SELECT COALESCE(SUM(commission_cents), 0) FROM public.affiliate_commissions
                                     WHERE affiliate_id = v_aff AND status = 'validated'),
    'commissions_invoiced_cents', (SELECT COALESCE(SUM(commission_cents), 0) FROM public.affiliate_commissions
                                    WHERE affiliate_id = v_aff AND status = 'invoiced'),
    'commissions_paid_cents', (SELECT COALESCE(SUM(commission_cents), 0) FROM public.affiliate_commissions
                                WHERE affiliate_id = v_aff AND status = 'paid'),
    'on_hold_count', (SELECT COUNT(*) FROM public.affiliate_commissions
                       WHERE affiliate_id = v_aff AND status = 'on_hold'),
    'scans', (SELECT COUNT(*) FROM public.tracking_events te
               JOIN public.tracking_campaigns tc ON tc.id = te.campaign_id
              WHERE tc.owner_type = 'affiliate' AND tc.owner_id = v_aff
                AND te.event_type = 'scan' AND COALESCE(te.ua_family,'') <> 'bot'),
    'signups', (SELECT COUNT(DISTINCT te.user_id) FROM public.tracking_events te
                 JOIN public.tracking_campaigns tc ON tc.id = te.campaign_id
                WHERE tc.owner_type = 'affiliate' AND tc.owner_id = v_aff
                  AND te.event_type = 'signup_completed'),
    'first_purchases', (SELECT COUNT(DISTINCT te.user_id) FROM public.tracking_events te
                 JOIN public.tracking_campaigns tc ON tc.id = te.campaign_id
                WHERE tc.owner_type = 'affiliate' AND tc.owner_id = v_aff
                  AND te.event_type = 'first_purchase'),
    'unique_visitors', (SELECT COUNT(DISTINCT te.visitor_id) FROM public.tracking_events te
                 JOIN public.tracking_campaigns tc ON tc.id = te.campaign_id
                WHERE tc.owner_type = 'affiliate' AND tc.owner_id = v_aff
                  AND te.event_type = 'scan' AND COALESCE(te.ua_family,'') <> 'bot'),
    'repeat_rate', (
      SELECT CASE WHEN COUNT(*) FILTER (WHERE n >= 1) = 0 THEN 0
                  ELSE ROUND(COUNT(*) FILTER (WHERE n >= 2)::numeric / COUNT(*) FILTER (WHERE n >= 1), 4) END
      FROM (SELECT referral_id, COUNT(*) AS n FROM public.affiliate_commissions
             WHERE affiliate_id = v_aff AND adjustment_of_id IS NULL AND status <> 'cancelled'
             GROUP BY referral_id) s)
  ) INTO v_res;
  RETURN v_res;
END;
$$;

-- 2. Payouts du portail
CREATE OR REPLACE FUNCTION public.affiliate_my_payouts(_affiliate_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, invoice_number text, period_start date, period_end date,
  total_cents int, vat_mode text, status text, pdf_path text,
  issued_at timestamptz, paid_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid;
BEGIN
  v_aff := public.affiliate_target_id(_affiliate_id);
  RETURN QUERY
  SELECT pi.id, pi.invoice_number, pi.period_start, pi.period_end, pi.total_cents,
         pi.vat_mode, pi.status, pi.pdf_path, pi.issued_at, pi.paid_at
  FROM public.affiliate_payout_invoices pi
  WHERE pi.affiliate_id = v_aff
  ORDER BY pi.period_start DESC;
END;
$$;

-- 3. Campagnes du portail (+ stats)
CREATE OR REPLACE FUNCTION public.affiliate_my_campaigns(_affiliate_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, slug text, name text, landing_path text, utm_source text, status text,
  is_default boolean, scans bigint, unique_visitors bigint, signups bigint, first_purchases bigint,
  created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid;
BEGIN
  v_aff := public.affiliate_target_id(_affiliate_id);
  RETURN QUERY
  SELECT tc.id, tc.slug, tc.name, tc.landing_path, tc.utm_source, tc.status,
         (tc.id = a.default_campaign_id),
         COALESCE(e.scans, 0), COALESCE(e.visitors, 0), COALESCE(e.signups, 0), COALESCE(e.purchases, 0),
         tc.created_at
  FROM public.tracking_campaigns tc
  JOIN public.affiliates a ON a.id = v_aff
  LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE te.event_type = 'scan' AND COALESCE(te.ua_family,'') <> 'bot') AS scans,
           COUNT(DISTINCT te.visitor_id) FILTER (WHERE te.event_type = 'scan') AS visitors,
           COUNT(DISTINCT te.user_id) FILTER (WHERE te.event_type = 'signup_completed') AS signups,
           COUNT(DISTINCT te.user_id) FILTER (WHERE te.event_type = 'first_purchase') AS purchases
    FROM public.tracking_events te WHERE te.campaign_id = tc.id) e ON true
  WHERE tc.owner_type = 'affiliate' AND tc.owner_id = v_aff
  ORDER BY (tc.id = a.default_campaign_id) DESC, tc.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_create_campaign(
  _name text, _landing_path text, _affiliate_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid; v_code text; v_slug text; v_active int; v_id uuid;
BEGIN
  v_aff := public.affiliate_target_id(_affiliate_id);
  IF _affiliate_id IS NOT NULL AND public.is_admin() THEN
    NULL;
  ELSIF NOT EXISTS (SELECT 1 FROM public.affiliates WHERE id = v_aff AND status = 'active') THEN
    RAISE EXCEPTION 'Compte apporteur inactif';
  END IF;
  IF _landing_path IS NULL OR _landing_path NOT IN (
      '/', '/catalogue', '/promotions', '/economies', '/pro', '/professionnels',
      '/pharmacies', '/sourcing', '/onboarding') THEN
    RAISE EXCEPTION 'Destination non autorisee';
  END IF;
  IF COALESCE(btrim(_name), '') = '' THEN RAISE EXCEPTION 'Nom requis'; END IF;

  SELECT COUNT(*) INTO v_active FROM public.tracking_campaigns
   WHERE owner_type = 'affiliate' AND owner_id = v_aff AND status = 'active';
  IF v_active >= 50 THEN RAISE EXCEPTION 'Plafond de 50 campagnes actives atteint'; END IF;

  SELECT affiliate_code INTO v_code FROM public.affiliates WHERE id = v_aff;
  v_slug := lower(regexp_replace(v_code || '-' || _name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := btrim(left(v_slug, 40), '-') || '-' || lower(substr(md5(gen_random_uuid()::text), 1, 5));

  INSERT INTO public.tracking_campaigns (
    slug, name, owner_type, owner_id, partner_label, landing_path,
    utm_source, utm_medium, utm_campaign, status)
  VALUES (v_slug, btrim(_name), 'affiliate', v_aff,
          (SELECT display_name FROM public.affiliates WHERE id = v_aff), _landing_path,
          lower(v_code), 'affiliate', 'campagne', 'active')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_set_campaign_status(
  _campaign_id uuid, _status text, _affiliate_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid;
BEGIN
  v_aff := public.affiliate_target_id(_affiliate_id);
  IF _status NOT IN ('active','paused') THEN RAISE EXCEPTION 'statut invalide'; END IF;
  UPDATE public.tracking_campaigns SET status = _status
   WHERE id = _campaign_id AND owner_type = 'affiliate' AND owner_id = v_aff;
END;
$$;

-- 4. Timeseries hebdo (portail + admin)
CREATE OR REPLACE FUNCTION public.affiliate_weekly_series(_affiliate_id uuid DEFAULT NULL, _weeks int DEFAULT 12)
RETURNS TABLE (week_start date, signups bigint, orders bigint, commission_cents bigint, scans bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid; v_from date;
BEGIN
  v_aff := public.affiliate_target_id(_affiliate_id);
  v_from := (date_trunc('week', now()) - ((GREATEST(_weeks, 1) - 1) || ' weeks')::interval)::date;
  RETURN QUERY
  WITH weeks AS (
    SELECT generate_series(v_from, date_trunc('week', now())::date, '1 week')::date AS w
  )
  SELECT w.w,
    (SELECT COUNT(*) FROM public.affiliate_referrals r
      WHERE r.affiliate_id = v_aff AND date_trunc('week', r.attributed_at)::date = w.w),
    (SELECT COUNT(*) FROM public.affiliate_commissions c
      WHERE c.affiliate_id = v_aff AND c.adjustment_of_id IS NULL AND c.status <> 'cancelled'
        AND date_trunc('week', c.created_at)::date = w.w),
    (SELECT COALESCE(SUM(c.commission_cents), 0) FROM public.affiliate_commissions c
      WHERE c.affiliate_id = v_aff AND c.status <> 'cancelled'
        AND date_trunc('week', c.created_at)::date = w.w),
    (SELECT COUNT(*) FROM public.tracking_events te
       JOIN public.tracking_campaigns tc ON tc.id = te.campaign_id
      WHERE tc.owner_type = 'affiliate' AND tc.owner_id = v_aff
        AND te.event_type = 'scan' AND COALESCE(te.ua_family,'') <> 'bot'
        AND date_trunc('week', te.created_at)::date = w.w)
  FROM weeks w ORDER BY w.w;
END;
$$;

-- 5. Admin : détail apporteur
CREATE OR REPLACE FUNCTION public.affiliate_admin_referrals(_affiliate_id uuid)
RETURNS TABLE (
  id uuid, user_id uuid, full_name text, email text, company_name text,
  attributed_at timestamptz, first_order_at timestamptz, window_expires_at timestamptz,
  status text, orders_count int, revenue_ht_cents bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN QUERY
  SELECT r.id, r.user_id,
         COALESCE(p.full_name, p.first_name || ' ' || p.last_name), p.email, p.company_name,
         r.attributed_at, r.first_order_at, r.window_expires_at, r.status,
         COALESCE(cc.n, 0)::int, COALESCE(cc.ht, 0)::bigint
  FROM public.affiliate_referrals r
  LEFT JOIN public.profiles p ON p.id = r.user_id
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
         COALESCE(p.full_name, p.company_name), p.email,
         c.order_total_ht_cents, c.net_margin_cents, c.base_amount_cents,
         c.commission_cents, c.margin_guard_hit, c.status,
         c.validate_after, c.calc_details, ru.version,
         c.adjustment_of_id, oo.order_number, c.cancelled_reason,
         pi.invoice_number, c.created_at
  FROM public.affiliate_commissions c
  JOIN public.affiliates a ON a.id = c.affiliate_id
  JOIN public.affiliate_referrals r ON r.id = c.referral_id
  LEFT JOIN public.profiles p ON p.id = r.user_id
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

CREATE OR REPLACE FUNCTION public.affiliate_admin_payouts(_affiliate_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, affiliate_id uuid, affiliate_code text, affiliate_name text,
  invoice_number text, period_start date, period_end date, total_cents int,
  vat_mode text, status text, pdf_path text, issued_at timestamptz, paid_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN QUERY
  SELECT pi.id, pi.affiliate_id, a.affiliate_code, a.display_name,
         pi.invoice_number, pi.period_start, pi.period_end, pi.total_cents,
         pi.vat_mode, pi.status, pi.pdf_path, pi.issued_at, pi.paid_at
  FROM public.affiliate_payout_invoices pi
  JOIN public.affiliates a ON a.id = pi.affiliate_id
  WHERE (_affiliate_id IS NULL OR pi.affiliate_id = _affiliate_id)
  ORDER BY pi.period_start DESC;
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
         r.effective_from, r.effective_to, r.created_by, p.email, r.created_at
  FROM public.affiliate_commission_rules r
  LEFT JOIN public.profiles p ON p.id = r.created_by
  WHERE r.scope = _scope
    AND COALESCE(r.affiliate_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(_affiliate_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY r.version DESC;
END;
$$;

-- 6. Paramètres de coûts : publication versionnée
CREATE OR REPLACE FUNCTION public.affiliate_publish_cost_params(
  _payment_fee_bp int, _payment_fee_fixed_cents int, _deduct_cagnotte boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  IF _payment_fee_bp < 0 OR _payment_fee_bp > 2000 THEN RAISE EXCEPTION 'frais pourcentage hors bornes'; END IF;
  IF _payment_fee_fixed_cents < 0 OR _payment_fee_fixed_cents > 10000 THEN RAISE EXCEPTION 'frais fixes hors bornes'; END IF;

  UPDATE public.affiliate_margin_cost_params SET effective_to = now() WHERE effective_to IS NULL;
  INSERT INTO public.affiliate_margin_cost_params (
    payment_fee_bp, payment_fee_fixed_cents, deduct_cagnotte, created_by)
  VALUES (_payment_fee_bp, _payment_fee_fixed_cents, COALESCE(_deduct_cagnotte, true), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 7. on_hold : justification obligatoire
CREATE OR REPLACE FUNCTION public.affiliate_admin_resolve_on_hold(
  _commission_id uuid, _net_margin_cents int, _justification text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  IF COALESCE(btrim(_justification), '') = '' THEN RAISE EXCEPTION 'Justification requise'; END IF;

  v_res := public.affiliate_admin_resolve_on_hold(_commission_id, _net_margin_cents);

  UPDATE public.affiliate_commissions
     SET calc_details = calc_details
           || jsonb_build_object(
                'manual_resolution', jsonb_build_object(
                  'justification', btrim(_justification),
                  'resolved_by', auth.uid(),
                  'resolved_at', now(),
                  'net_margin_cents', _net_margin_cents)),
         updated_at = now()
   WHERE id = _commission_id;

  RETURN v_res;
END;
$$;

-- 8. Payout payé : date de virement
CREATE OR REPLACE FUNCTION public.affiliate_admin_mark_payout_paid(_invoice_id uuid, _paid_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  UPDATE public.affiliate_payout_invoices
     SET status = 'paid', paid_at = COALESCE(_paid_at, now())
   WHERE id = _invoice_id;
  UPDATE public.affiliate_commissions
     SET status = 'paid', updated_at = now()
   WHERE payout_invoice_id = _invoice_id AND status = 'invoiced';
END;
$$;

-- 9. Suis-je apporteur ? (gating portail, jamais bloqué par RLS)
CREATE OR REPLACE FUNCTION public.affiliate_my_account()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id, 'affiliate_code', a.affiliate_code, 'display_name', a.display_name,
    'company_name', a.company_name, 'email', a.email, 'status', a.status,
    'vat_number', a.vat_number,
    'iban_masked', CASE WHEN a.iban IS NULL THEN NULL
                        ELSE '…' || right(regexp_replace(a.iban, '\s', '', 'g'), 4) END,
    'default_campaign_id', a.default_campaign_id)
  INTO v FROM public.affiliates a WHERE a.user_id = auth.uid();
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_account(_affiliate_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  SELECT jsonb_build_object(
    'id', a.id, 'affiliate_code', a.affiliate_code, 'display_name', a.display_name,
    'company_name', a.company_name, 'email', a.email, 'status', a.status,
    'vat_number', a.vat_number, 'phone', a.phone, 'iban', a.iban,
    'iban_masked', CASE WHEN a.iban IS NULL THEN NULL
                        ELSE '…' || right(regexp_replace(a.iban, '\s', '', 'g'), 4) END,
    'notes_admin', a.notes_admin, 'user_id', a.user_id,
    'default_campaign_id', a.default_campaign_id, 'created_at', a.created_at)
  INTO v FROM public.affiliates a WHERE a.id = _affiliate_id;
  RETURN v;
END;
$$;