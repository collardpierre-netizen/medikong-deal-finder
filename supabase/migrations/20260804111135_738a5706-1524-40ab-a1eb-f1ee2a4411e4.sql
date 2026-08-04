-- =========================================================
-- Module Apporteurs d'affaires (affiliation & commissions)
-- =========================================================

-- 0. Extensions des CHECK owner_type du module tracking existant
ALTER TABLE public.tracking_campaigns DROP CONSTRAINT IF EXISTS tracking_campaigns_owner_type_check;
ALTER TABLE public.tracking_campaigns ADD CONSTRAINT tracking_campaigns_owner_type_check
  CHECK (owner_type = ANY (ARRAY['vendor','brand','manufacturer','medikong','partner','affiliate']));
ALTER TABLE public.activation_codes DROP CONSTRAINT IF EXISTS activation_codes_owner_type_check;
ALTER TABLE public.activation_codes ADD CONSTRAINT activation_codes_owner_type_check
  CHECK (owner_type = ANY (ARRAY['vendor','brand','manufacturer','medikong','partner','affiliate']));

-- 1. Apporteurs
CREATE TABLE IF NOT EXISTS public.affiliates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid UNIQUE,
  affiliate_code  text UNIQUE NOT NULL,
  display_name    text NOT NULL,
  company_name    text,
  vat_number      text,
  email           text NOT NULL,
  phone           text,
  iban            text,
  status          text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','active','suspended','terminated')),
  default_campaign_id uuid REFERENCES public.tracking_campaigns(id),
  notes_admin     text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliates TO authenticated;
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY affiliates_self_read ON public.affiliates
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY affiliates_admin_write ON public.affiliates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Helper : id de l'apporteur connecté
CREATE OR REPLACE FUNCTION public.current_affiliate_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.affiliates WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2. Règles de commission versionnées
CREATE TABLE IF NOT EXISTS public.affiliate_commission_rules (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope                     text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','affiliate')),
  affiliate_id              uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  version                   int NOT NULL,
  base_rate_bp              int NOT NULL DEFAULT 200,
  margin_guard_threshold_bp int NOT NULL DEFAULT 2000,
  margin_rate_bp            int NOT NULL DEFAULT 500,
  attribution_months        int NOT NULL DEFAULT 12,
  validation_delay_days     int NOT NULL DEFAULT 30,
  payout_threshold_cents    int NOT NULL DEFAULT 5000,
  self_purchase_allowed     boolean NOT NULL DEFAULT false,
  monthly_cap_cents         int,
  effective_from            timestamptz NOT NULL DEFAULT now(),
  effective_to              timestamptz,
  created_by                uuid,
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, affiliate_id, version),
  CHECK ((scope = 'global' AND affiliate_id IS NULL) OR (scope = 'affiliate' AND affiliate_id IS NOT NULL))
);
GRANT SELECT ON public.affiliate_commission_rules TO authenticated;
GRANT ALL ON public.affiliate_commission_rules TO service_role;
ALTER TABLE public.affiliate_commission_rules ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_rule_per_scope
  ON public.affiliate_commission_rules (scope, COALESCE(affiliate_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE effective_to IS NULL;

CREATE POLICY affiliate_rules_read ON public.affiliate_commission_rules
  FOR SELECT TO authenticated
  USING (public.is_admin() OR scope = 'global' OR affiliate_id = public.current_affiliate_id());
CREATE POLICY affiliate_rules_admin_write ON public.affiliate_commission_rules
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.affiliate_commission_rules (scope, affiliate_id, version)
SELECT 'global', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM public.affiliate_commission_rules WHERE scope = 'global');

-- 3. Paramètres de coûts pour la marge nette
CREATE TABLE IF NOT EXISTS public.affiliate_margin_cost_params (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_fee_bp         int NOT NULL DEFAULT 180,
  payment_fee_fixed_cents int NOT NULL DEFAULT 25,
  deduct_cagnotte        boolean NOT NULL DEFAULT true,
  effective_from         timestamptz NOT NULL DEFAULT now(),
  effective_to           timestamptz,
  created_by             uuid,
  created_at             timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliate_margin_cost_params TO authenticated;
GRANT ALL ON public.affiliate_margin_cost_params TO service_role;
ALTER TABLE public.affiliate_margin_cost_params ENABLE ROW LEVEL SECURITY;
CREATE POLICY affiliate_cost_params_read ON public.affiliate_margin_cost_params
  FOR SELECT TO authenticated USING (true);
CREATE POLICY affiliate_cost_params_admin_write ON public.affiliate_margin_cost_params
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.affiliate_margin_cost_params (payment_fee_bp, payment_fee_fixed_cents)
SELECT 180, 25 WHERE NOT EXISTS (SELECT 1 FROM public.affiliate_margin_cost_params);

-- 4. Clients apportés
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id      uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL,
  campaign_id       uuid REFERENCES public.tracking_campaigns(id),
  code_id           uuid REFERENCES public.activation_codes(id),
  attributed_at     timestamptz NOT NULL DEFAULT now(),
  first_order_at    timestamptz,
  window_expires_at timestamptz,
  status            text NOT NULL DEFAULT 'attributed'
    CHECK (status IN ('attributed','converted','expired','revoked')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_affiliate_per_user UNIQUE (user_id)
);
GRANT SELECT ON public.affiliate_referrals TO authenticated;
GRANT ALL ON public.affiliate_referrals TO service_role;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate ON public.affiliate_referrals (affiliate_id, status);
-- Table brute : admin uniquement (l'apporteur passe par des RPC pseudonymisées)
CREATE POLICY affiliate_referrals_admin_read ON public.affiliate_referrals
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY affiliate_referrals_admin_write ON public.affiliate_referrals
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. Factures de payout (avant commissions pour la FK)
CREATE TABLE IF NOT EXISTS public.affiliate_payout_invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id   uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  invoice_number text UNIQUE,
  period_start   date NOT NULL,
  period_end     date NOT NULL,
  total_cents    int NOT NULL,
  vat_mode       text NOT NULL DEFAULT 'none' CHECK (vat_mode IN ('none','vat_21','reverse_charge')),
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','cancelled')),
  pdf_path       text,
  issued_at      timestamptz,
  paid_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (affiliate_id, period_start, period_end)
);
GRANT SELECT ON public.affiliate_payout_invoices TO authenticated;
GRANT ALL ON public.affiliate_payout_invoices TO service_role;
ALTER TABLE public.affiliate_payout_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY payout_invoices_self_read ON public.affiliate_payout_invoices
  FOR SELECT TO authenticated
  USING (public.is_admin() OR affiliate_id = public.current_affiliate_id());
CREATE POLICY payout_invoices_admin_write ON public.affiliate_payout_invoices
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. Commissions
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id         uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id          uuid NOT NULL REFERENCES public.affiliate_referrals(id) ON DELETE CASCADE,
  order_id             uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rule_id              uuid NOT NULL REFERENCES public.affiliate_commission_rules(id),
  order_total_ht_cents int NOT NULL,
  net_margin_cents     int,
  base_amount_cents    int NOT NULL,
  margin_guard_hit     boolean NOT NULL DEFAULT false,
  commission_cents     int NOT NULL,
  calc_details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','on_hold','validated','invoiced','paid','cancelled')),
  validate_after       timestamptz NOT NULL DEFAULT now(),
  payout_invoice_id    uuid REFERENCES public.affiliate_payout_invoices(id),
  adjustment_of_id     uuid REFERENCES public.affiliate_commissions(id),
  cancelled_reason     text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
-- Idempotence absolue : une seule commission "normale" par commande
-- (les lignes de régularisation négatives portent adjustment_of_id)
CREATE UNIQUE INDEX IF NOT EXISTS one_commission_per_order
  ON public.affiliate_commissions (order_id) WHERE adjustment_of_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate ON public.affiliate_commissions (affiliate_id, status);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_validation ON public.affiliate_commissions (status, validate_after);

CREATE POLICY affiliate_commissions_self_read ON public.affiliate_commissions
  FOR SELECT TO authenticated
  USING (public.is_admin() OR affiliate_id = public.current_affiliate_id());
CREATE POLICY affiliate_commissions_admin_write ON public.affiliate_commissions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. Numérotation APP-AAAA-NNNN
CREATE OR REPLACE FUNCTION public.generate_document_number(p_document_type text, p_year integer DEFAULT NULL::integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_year   int := COALESCE(p_year, EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Brussels'))::int);
  v_prefix text;
  v_pad    int;
  v_next   int;
BEGIN
  v_prefix := CASE p_document_type
    WHEN 'sale'               THEN 'MK'
    WHEN 'commission_invoice' THEN 'COM'
    WHEN 'credit_note'        THEN 'NC'
    WHEN 'delivery_note'      THEN 'BL'
    WHEN 'affiliate_payout'   THEN 'APP'
    ELSE NULL
  END;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Type de document inconnu: %', p_document_type;
  END IF;

  v_pad := CASE p_document_type WHEN 'sale' THEN 5 ELSE 4 END;

  INSERT INTO public.document_number_sequences (document_type, year, last_number)
  VALUES (p_document_type, v_year, 0)
  ON CONFLICT (document_type, year) DO NOTHING;

  UPDATE public.document_number_sequences
     SET last_number = last_number + 1,
         updated_at  = now()
   WHERE document_type = p_document_type AND year = v_year
  RETURNING last_number INTO v_next;

  RETURN v_prefix || '-' || v_year || '-' ||
         CASE WHEN v_next > (10 ^ v_pad - 1)::int
              THEN v_next::text
              ELSE lpad(v_next::text, v_pad, '0')
         END;
END;
$function$;

-- 8. Résolution de règle
CREATE OR REPLACE FUNCTION public.affiliate_resolve_rule(_affiliate_id uuid)
RETURNS public.affiliate_commission_rules
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.* FROM public.affiliate_commission_rules r
  WHERE r.effective_to IS NULL
    AND ((r.scope = 'affiliate' AND r.affiliate_id = _affiliate_id) OR r.scope = 'global')
  ORDER BY (r.scope = 'affiliate') DESC
  LIMIT 1;
$$;

-- 9. Marge nette MediKong sur une commande (en cents)
-- Réutilise orders.commission_total_ht (circuit commission existant) et,
-- à défaut, la somme des order_items.commission_ht. NULL = incalculable -> on_hold.
CREATE OR REPLACE FUNCTION public.affiliate_compute_order_net_margin_cents(_order_id uuid)
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_commission numeric;
  v_total_incl numeric;
  v_cagnotte   numeric;
  v_fee_bp     int;
  v_fee_fixed  int;
  v_deduct_cag boolean;
  v_fees       numeric;
BEGIN
  SELECT o.commission_total_ht, o.total_incl_vat, COALESCE(o.cagnotte_used, 0)
    INTO v_commission, v_total_incl, v_cagnotte
  FROM public.orders o WHERE o.id = _order_id;

  IF v_commission IS NULL THEN
    SELECT SUM(oi.commission_ht) INTO v_commission
    FROM public.order_items oi WHERE oi.order_id = _order_id;
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
  v_fees := ROUND(COALESCE(v_total_incl, 0) * 100 * v_fee_bp / 10000.0) + v_fee_fixed;

  RETURN ROUND(v_commission * 100)::int
         - v_fees::int
         - CASE WHEN COALESCE(v_deduct_cag, true) THEN ROUND(v_cagnotte * 100)::int ELSE 0 END;
END;
$$;

-- 10. Coeur du calcul (partagé par le moteur et le simulateur)
CREATE OR REPLACE FUNCTION public.affiliate_calc_commission(
  _order_total_ht_cents int,
  _net_margin_cents int,
  _base_rate_bp int,
  _margin_guard_threshold_bp int,
  _margin_rate_bp int
) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_base int;
  v_guard numeric;
  v_hit boolean := false;
  v_commission int;
BEGIN
  v_base := FLOOR(_order_total_ht_cents * _base_rate_bp / 10000.0)::int;

  IF _net_margin_cents IS NULL THEN
    RETURN jsonb_build_object(
      'computable', false,
      'base_amount_cents', v_base,
      'margin_guard_hit', false,
      'commission_cents', 0,
      'reason', 'net_margin_unavailable'
    );
  END IF;

  v_guard := _net_margin_cents * _margin_guard_threshold_bp / 10000.0;

  IF v_base > v_guard THEN
    v_hit := true;
    v_commission := GREATEST(FLOOR(_net_margin_cents * _margin_rate_bp / 10000.0)::int, 0);
  ELSE
    v_commission := GREATEST(v_base, 0);
  END IF;

  RETURN jsonb_build_object(
    'computable', true,
    'order_total_ht_cents', _order_total_ht_cents,
    'net_margin_cents', _net_margin_cents,
    'base_rate_bp', _base_rate_bp,
    'margin_guard_threshold_bp', _margin_guard_threshold_bp,
    'margin_rate_bp', _margin_rate_bp,
    'base_amount_cents', v_base,
    'guard_amount_cents', FLOOR(v_guard)::int,
    'margin_guard_hit', v_hit,
    'commission_cents', v_commission
  );
END;
$$;

-- Simulateur admin
CREATE OR REPLACE FUNCTION public.affiliate_simulate_commission(
  _order_total_ht_cents int,
  _net_margin_cents int,
  _base_rate_bp int DEFAULT 200,
  _margin_guard_threshold_bp int DEFAULT 2000,
  _margin_rate_bp int DEFAULT 500
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.affiliate_calc_commission(
    _order_total_ht_cents, _net_margin_cents,
    _base_rate_bp, _margin_guard_threshold_bp, _margin_rate_bp);
$$;

-- 11. Moteur : traitement d'une commande payée
CREATE OR REPLACE FUNCTION public.affiliate_process_order_commission(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR v_order.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_paid');
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

  -- Auto-apport
  IF NOT v_rule.self_purchase_allowed AND v_aff.user_id IS NOT NULL AND v_aff.user_id = v_user THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_purchase_blocked');
  END IF;

  v_paid_at := COALESCE(v_order.updated_at, v_order.created_at, now());

  -- 1ère commande : ouverture de la fenêtre d'attribution
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

  v_status := CASE WHEN (v_calc->>'computable')::boolean THEN 'pending' ELSE 'on_hold' END;

  INSERT INTO public.affiliate_commissions (
    affiliate_id, referral_id, order_id, rule_id,
    order_total_ht_cents, net_margin_cents, base_amount_cents,
    margin_guard_hit, commission_cents, calc_details, status, validate_after)
  VALUES (
    v_ref.affiliate_id, v_ref.id, _order_id, v_rule.id,
    v_total, v_margin, (v_calc->>'base_amount_cents')::int,
    COALESCE((v_calc->>'margin_guard_hit')::boolean, false),
    COALESCE((v_calc->>'commission_cents')::int, 0),
    v_calc || jsonb_build_object('rule_version', v_rule.version, 'paid_at', v_paid_at),
    v_status,
    v_paid_at + (v_rule.validation_delay_days || ' days')::interval)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_existing;

  RETURN jsonb_build_object('ok', true, 'commission_id', v_existing, 'status', v_status, 'calc', v_calc);
END;
$$;

-- Trigger commande payée
CREATE OR REPLACE FUNCTION public.trg_affiliate_on_order_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid')
     AND COALESCE(NEW.is_test, false) = false THEN
    BEGIN
      PERFORM public.affiliate_process_order_commission(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'affiliate commission failed for order %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS affiliate_on_order_paid ON public.orders;
CREATE TRIGGER affiliate_on_order_paid
AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_affiliate_on_order_paid();

-- Remboursement / annulation
CREATE OR REPLACE FUNCTION public.trg_affiliate_on_order_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.affiliate_commissions%ROWTYPE;
BEGIN
  IF NEW.payment_status = 'refunded' OR NEW.status = 'cancelled' THEN
    FOR r IN SELECT * FROM public.affiliate_commissions
             WHERE order_id = NEW.id AND adjustment_of_id IS NULL AND status <> 'cancelled'
    LOOP
      IF r.status IN ('pending','on_hold','validated') THEN
        UPDATE public.affiliate_commissions
           SET status = 'cancelled', cancelled_reason = 'refund', updated_at = now()
         WHERE id = r.id;
      ELSIF r.status IN ('invoiced','paid') THEN
        INSERT INTO public.affiliate_commissions (
          affiliate_id, referral_id, order_id, rule_id, order_total_ht_cents,
          net_margin_cents, base_amount_cents, margin_guard_hit, commission_cents,
          calc_details, status, validate_after, adjustment_of_id, cancelled_reason)
        SELECT r.affiliate_id, r.referral_id, r.order_id, r.rule_id, -r.order_total_ht_cents,
               r.net_margin_cents, -r.base_amount_cents, r.margin_guard_hit, -r.commission_cents,
               jsonb_build_object('adjustment', true, 'origin_commission_id', r.id, 'reason', 'refund'),
               'validated', now(), r.id, 'refund'
        WHERE NOT EXISTS (
          SELECT 1 FROM public.affiliate_commissions a WHERE a.adjustment_of_id = r.id);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS affiliate_on_order_refund ON public.orders;
CREATE TRIGGER affiliate_on_order_refund
AFTER UPDATE OF payment_status, status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_affiliate_on_order_refund();

-- 12. Attribution à l'inscription (branchée sur tracking_events existant)
CREATE OR REPLACE FUNCTION public.trg_affiliate_attribute_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid;
BEGIN
  IF NEW.event_type <> 'signup_completed' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.owner_id INTO v_aff
  FROM public.tracking_campaigns c
  WHERE c.id = NEW.campaign_id AND c.owner_type = 'affiliate';

  IF v_aff IS NULL AND NEW.code_id IS NOT NULL THEN
    SELECT ac.owner_id INTO v_aff
    FROM public.activation_codes ac
    WHERE ac.id = NEW.code_id AND ac.owner_type = 'affiliate';
  END IF;

  IF v_aff IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.affiliate_referrals (affiliate_id, user_id, campaign_id, code_id)
  VALUES (v_aff, NEW.user_id, NEW.campaign_id, NEW.code_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS affiliate_attribute_on_signup ON public.tracking_events;
CREATE TRIGGER affiliate_attribute_on_signup
AFTER INSERT ON public.tracking_events
FOR EACH ROW EXECUTE FUNCTION public.trg_affiliate_attribute_on_signup();

-- 13. Crons : validation quotidienne + payout mensuel
CREATE OR REPLACE FUNCTION public.affiliate_validate_due_commissions()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  WITH upd AS (
    UPDATE public.affiliate_commissions c
       SET status = 'validated', updated_at = now()
      FROM public.orders o
     WHERE o.id = c.order_id
       AND c.status = 'pending'
       AND c.validate_after < now()
       AND o.payment_status = 'paid'
       AND COALESCE(o.status::text, '') <> 'cancelled'
    RETURNING c.id)
  SELECT COUNT(*) INTO v_count FROM upd;

  UPDATE public.affiliate_referrals
     SET status = 'expired'
   WHERE status = 'converted' AND window_expires_at IS NOT NULL AND window_expires_at < now();

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_generate_monthly_payouts(
  _period_start date DEFAULT NULL, _period_end date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start date := COALESCE(_period_start, (date_trunc('month', now()) - interval '1 month')::date);
  v_end   date := COALESCE(_period_end, (date_trunc('month', now()) - interval '1 day')::date);
  v_aff   record;
  v_rule  public.affiliate_commission_rules%ROWTYPE;
  v_total int;
  v_inv   uuid;
  v_created int := 0;
  v_skipped int := 0;
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  FOR v_aff IN SELECT * FROM public.affiliates WHERE status = 'active' LOOP
    IF EXISTS (SELECT 1 FROM public.affiliate_payout_invoices
                WHERE affiliate_id = v_aff.id AND period_start = v_start AND period_end = v_end) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(commission_cents), 0) INTO v_total
      FROM public.affiliate_commissions
     WHERE affiliate_id = v_aff.id AND status = 'validated';

    v_rule := public.affiliate_resolve_rule(v_aff.id);

    IF v_total < COALESCE(v_rule.payout_threshold_cents, 5000) OR v_total <= 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.affiliate_payout_invoices (
      affiliate_id, invoice_number, period_start, period_end, total_cents,
      vat_mode, status, issued_at)
    VALUES (
      v_aff.id, public.generate_document_number('affiliate_payout'), v_start, v_end, v_total,
      CASE WHEN v_aff.vat_number IS NOT NULL THEN 'reverse_charge' ELSE 'none' END,
      'issued', now())
    RETURNING id INTO v_inv;

    UPDATE public.affiliate_commissions
       SET status = 'invoiced', payout_invoice_id = v_inv, updated_at = now()
     WHERE affiliate_id = v_aff.id AND status = 'validated';

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'skipped', v_skipped,
                            'period_start', v_start, 'period_end', v_end);
END;
$$;

-- 14. RPC portail apporteur
CREATE OR REPLACE FUNCTION public.affiliate_current_rule()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid; v_rule public.affiliate_commission_rules%ROWTYPE;
BEGIN
  v_aff := public.current_affiliate_id();
  IF v_aff IS NULL THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  v_rule := public.affiliate_resolve_rule(v_aff);
  RETURN jsonb_build_object(
    'base_rate_bp', v_rule.base_rate_bp,
    'margin_guard_threshold_bp', v_rule.margin_guard_threshold_bp,
    'margin_rate_bp', v_rule.margin_rate_bp,
    'attribution_months', v_rule.attribution_months,
    'validation_delay_days', v_rule.validation_delay_days,
    'payout_threshold_cents', v_rule.payout_threshold_cents,
    'scope', v_rule.scope, 'version', v_rule.version);
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_my_referrals()
RETURNS TABLE (
  pseudo text, attributed_at timestamptz, first_order_at timestamptz,
  window_expires_at timestamptz, status text, orders_count int, revenue_ht_cents bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid;
BEGIN
  v_aff := public.current_affiliate_id();
  IF v_aff IS NULL THEN RAISE EXCEPTION 'Acces refuse'; END IF;
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

CREATE OR REPLACE FUNCTION public.affiliate_my_commissions()
RETURNS TABLE (
  id uuid, order_id uuid, order_date timestamptz, pseudo text,
  order_total_ht_cents int, commission_cents int, margin_guard_hit boolean,
  status text, validate_after timestamptz, calc_details jsonb, invoice_number text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid;
BEGIN
  v_aff := public.current_affiliate_id();
  IF v_aff IS NULL THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN QUERY
  SELECT c.id, c.order_id, o.created_at,
         'Client #' || upper(substr(md5(r.user_id::text || r.affiliate_id::text), 1, 4)),
         c.order_total_ht_cents, c.commission_cents, c.margin_guard_hit,
         c.status, c.validate_after, c.calc_details, pi.invoice_number
  FROM public.affiliate_commissions c
  JOIN public.affiliate_referrals r ON r.id = c.referral_id
  LEFT JOIN public.orders o ON o.id = c.order_id
  LEFT JOIN public.affiliate_payout_invoices pi ON pi.id = c.payout_invoice_id
  WHERE c.affiliate_id = v_aff
  ORDER BY o.created_at DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aff uuid; v_res jsonb;
BEGIN
  v_aff := public.current_affiliate_id();
  IF v_aff IS NULL THEN RAISE EXCEPTION 'Acces refuse'; END IF;

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

-- 15. RPC admin
CREATE OR REPLACE FUNCTION public.affiliate_admin_list()
RETURNS TABLE (
  id uuid, affiliate_code text, display_name text, company_name text, email text,
  status text, user_id uuid, referrals_total bigint, referrals_active bigint,
  revenue_ht_cents bigint, commissions_pending_cents bigint,
  commissions_validated_cents bigint, commissions_paid_cents bigint,
  last_payout_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN QUERY
  SELECT a.id, a.affiliate_code, a.display_name, a.company_name, a.email, a.status, a.user_id,
    (SELECT COUNT(*) FROM public.affiliate_referrals r WHERE r.affiliate_id = a.id),
    (SELECT COUNT(*) FROM public.affiliate_referrals r WHERE r.affiliate_id = a.id
       AND r.status = 'converted' AND (r.window_expires_at IS NULL OR r.window_expires_at > now())),
    (SELECT COALESCE(SUM(c.order_total_ht_cents), 0) FROM public.affiliate_commissions c
       WHERE c.affiliate_id = a.id AND c.adjustment_of_id IS NULL AND c.status <> 'cancelled'),
    (SELECT COALESCE(SUM(c.commission_cents), 0) FROM public.affiliate_commissions c
       WHERE c.affiliate_id = a.id AND c.status IN ('pending','on_hold')),
    (SELECT COALESCE(SUM(c.commission_cents), 0) FROM public.affiliate_commissions c
       WHERE c.affiliate_id = a.id AND c.status = 'validated'),
    (SELECT COALESCE(SUM(c.commission_cents), 0) FROM public.affiliate_commissions c
       WHERE c.affiliate_id = a.id AND c.status = 'paid'),
    (SELECT MAX(pi.paid_at) FROM public.affiliate_payout_invoices pi WHERE pi.affiliate_id = a.id)
  FROM public.affiliates a
  ORDER BY a.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_kpis()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  SELECT jsonb_build_object(
    'affiliates_active', (SELECT COUNT(*) FROM public.affiliates WHERE status = 'active'),
    'referrals_total', (SELECT COUNT(*) FROM public.affiliate_referrals),
    'referrals_this_month', (SELECT COUNT(*) FROM public.affiliate_referrals
                              WHERE attributed_at >= date_trunc('month', now())),
    'revenue_ht_cents', (SELECT COALESCE(SUM(order_total_ht_cents), 0) FROM public.affiliate_commissions
                          WHERE adjustment_of_id IS NULL AND status <> 'cancelled'),
    'commissions_due_cents', (SELECT COALESCE(SUM(commission_cents), 0) FROM public.affiliate_commissions
                               WHERE status IN ('pending','validated','invoiced')),
    'commissions_paid_cents', (SELECT COALESCE(SUM(commission_cents), 0) FROM public.affiliate_commissions
                                WHERE status = 'paid'),
    'on_hold_count', (SELECT COUNT(*) FROM public.affiliate_commissions WHERE status = 'on_hold'),
    'guard_hit_pct', (SELECT CASE WHEN COUNT(*) = 0 THEN 0
                             ELSE ROUND(COUNT(*) FILTER (WHERE margin_guard_hit)::numeric / COUNT(*), 4) END
                      FROM public.affiliate_commissions WHERE adjustment_of_id IS NULL AND status <> 'cancelled')
  ) INTO v;
  RETURN v;
END;
$$;

-- Publication d'une nouvelle version de règle
CREATE OR REPLACE FUNCTION public.affiliate_publish_rule(
  _scope text, _affiliate_id uuid, _base_rate_bp int, _margin_guard_threshold_bp int,
  _margin_rate_bp int, _attribution_months int, _validation_delay_days int,
  _payout_threshold_cents int, _self_purchase_allowed boolean DEFAULT false,
  _monthly_cap_cents int DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_version int; v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  IF _scope NOT IN ('global','affiliate') THEN RAISE EXCEPTION 'scope invalide'; END IF;

  UPDATE public.affiliate_commission_rules
     SET effective_to = now()
   WHERE effective_to IS NULL AND scope = _scope
     AND COALESCE(affiliate_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(_affiliate_id, '00000000-0000-0000-0000-000000000000'::uuid);

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
    FROM public.affiliate_commission_rules
   WHERE scope = _scope
     AND COALESCE(affiliate_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(_affiliate_id, '00000000-0000-0000-0000-000000000000'::uuid);

  INSERT INTO public.affiliate_commission_rules (
    scope, affiliate_id, version, base_rate_bp, margin_guard_threshold_bp, margin_rate_bp,
    attribution_months, validation_delay_days, payout_threshold_cents,
    self_purchase_allowed, monthly_cap_cents, created_by)
  VALUES (_scope, CASE WHEN _scope = 'global' THEN NULL ELSE _affiliate_id END, v_version,
    _base_rate_bp, _margin_guard_threshold_bp, _margin_rate_bp, _attribution_months,
    _validation_delay_days, _payout_threshold_cents, _self_purchase_allowed, _monthly_cap_cents, auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Résolution manuelle d'une commission on_hold
CREATE OR REPLACE FUNCTION public.affiliate_admin_resolve_on_hold(
  _commission_id uuid, _net_margin_cents int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.affiliate_commissions%ROWTYPE; r public.affiliate_commission_rules%ROWTYPE; v_calc jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  SELECT * INTO c FROM public.affiliate_commissions WHERE id = _commission_id;
  IF c.status <> 'on_hold' THEN RAISE EXCEPTION 'Commission non en suspens'; END IF;
  SELECT * INTO r FROM public.affiliate_commission_rules WHERE id = c.rule_id;

  v_calc := public.affiliate_calc_commission(
    c.order_total_ht_cents, _net_margin_cents, r.base_rate_bp, r.margin_guard_threshold_bp, r.margin_rate_bp);

  UPDATE public.affiliate_commissions
     SET net_margin_cents = _net_margin_cents,
         base_amount_cents = (v_calc->>'base_amount_cents')::int,
         margin_guard_hit = (v_calc->>'margin_guard_hit')::boolean,
         commission_cents = (v_calc->>'commission_cents')::int,
         calc_details = v_calc || jsonb_build_object('resolved_manually_by', auth.uid(), 'resolved_at', now()),
         status = 'pending', updated_at = now()
   WHERE id = _commission_id;

  RETURN v_calc;
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_mark_payout_paid(_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  UPDATE public.affiliate_payout_invoices
     SET status = 'paid', paid_at = now() WHERE id = _invoice_id AND status = 'issued';
  UPDATE public.affiliate_commissions
     SET status = 'paid', updated_at = now()
   WHERE payout_invoice_id = _invoice_id AND status = 'invoiced';
END;
$$;

-- 16. Grants d'exécution
GRANT EXECUTE ON FUNCTION public.current_affiliate_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_current_rule() TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_my_referrals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_my_commissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_kpis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_simulate_commission(int, int, int, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_publish_rule(text, uuid, int, int, int, int, int, int, boolean, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_resolve_on_hold(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_mark_payout_paid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_validate_due_commissions() TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_generate_monthly_payouts(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_process_order_commission(uuid) TO service_role;