
-- ============================================
-- 1. Catalogue des plans / packs
-- ============================================
CREATE TYPE public.rfq_plan_type AS ENUM ('free_quota', 'credit_pack', 'monthly_plan', 'unlimited_plan');

CREATE TABLE public.rfq_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  plan_type public.rfq_plan_type NOT NULL,
  monthly_quota integer NOT NULL DEFAULT 0,
  credits_included integer NOT NULL DEFAULT 0,
  is_unlimited boolean NOT NULL DEFAULT false,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  duration_days integer,
  stripe_price_id text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rfq_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rfq_plans_public_read" ON public.rfq_plans
  FOR SELECT USING (is_active = true);

CREATE POLICY "rfq_plans_admin_all" ON public.rfq_plans
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================
-- 2. Solde par acheteur
-- ============================================
CREATE TABLE public.rfq_buyer_balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_quota integer NOT NULL DEFAULT 3,
  monthly_used integer NOT NULL DEFAULT 0,
  permanent_credits integer NOT NULL DEFAULT 0,
  active_plan_id uuid REFERENCES public.rfq_plans(id) ON DELETE SET NULL,
  plan_started_at timestamptz,
  plan_expires_at timestamptz,
  is_unlimited boolean NOT NULL DEFAULT false,
  rfq_unlimited_override boolean NOT NULL DEFAULT false,
  current_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  total_consumed integer NOT NULL DEFAULT 0,
  total_purchased integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rfq_buyer_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rfq_balances_owner_read" ON public.rfq_buyer_balances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "rfq_balances_admin_all" ON public.rfq_buyer_balances
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================
-- 3. Ledger des transactions
-- ============================================
CREATE TYPE public.rfq_ledger_kind AS ENUM (
  'consume', 'grant_admin', 'purchase_pack', 'subscribe_plan',
  'monthly_reset', 'refund', 'expire_plan'
);

CREATE TABLE public.rfq_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.rfq_ledger_kind NOT NULL,
  delta_quota integer NOT NULL DEFAULT 0,
  delta_permanent integer NOT NULL DEFAULT 0,
  rfq_id uuid REFERENCES public.rfqs(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.rfq_plans(id) ON DELETE SET NULL,
  performed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfq_ledger_user ON public.rfq_credit_ledger(user_id, created_at DESC);
CREATE INDEX idx_rfq_ledger_rfq ON public.rfq_credit_ledger(rfq_id) WHERE rfq_id IS NOT NULL;

ALTER TABLE public.rfq_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rfq_ledger_owner_read" ON public.rfq_credit_ledger
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "rfq_ledger_admin_all" ON public.rfq_credit_ledger
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================
-- 4. Triggers updated_at
-- ============================================
CREATE TRIGGER trg_rfq_plans_updated_at
  BEFORE UPDATE ON public.rfq_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_rfq_buyer_balances_updated_at
  BEFORE UPDATE ON public.rfq_buyer_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 5. Catalogue initial
-- ============================================
INSERT INTO public.rfq_plans (code, label, description, plan_type, monthly_quota, credits_included, is_unlimited, price_cents, duration_days, sort_order) VALUES
  ('free',          'Quota gratuit',     'Inclus pour tous les acheteurs vérifiés.',           'free_quota',     3,  0,  false, 0,     NULL, 0),
  ('pack_10',       'Pack 10 crédits',   '10 demandes de prix supplémentaires, valables à vie.','credit_pack',   0,  10, false, 4900,  NULL, 10),
  ('pack_50',       'Pack 50 crédits',   '50 demandes de prix, soit 4 € la demande.',          'credit_pack',    0,  50, false, 19900, NULL, 20),
  ('plan_standard', 'Forfait Standard',  '25 demandes par mois, renouvelées automatiquement.', 'monthly_plan',   25, 0,  false, 7900,  30,   30),
  ('plan_premium',  'Forfait Premium',   'Demandes de prix illimitées + support prioritaire.', 'unlimited_plan', 0,  0,  true,  19900, 30,   40)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 6. Helper ensure_buyer_balance
-- ============================================
CREATE OR REPLACE FUNCTION public.rfq_ensure_buyer_balance(_user_id uuid)
RETURNS public.rfq_buyer_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.rfq_buyer_balances;
BEGIN
  INSERT INTO public.rfq_buyer_balances (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.rfq_buyer_balances
     SET monthly_used = 0,
         current_period_start = date_trunc('month', now())
   WHERE user_id = _user_id
     AND current_period_start < date_trunc('month', now());

  UPDATE public.rfq_buyer_balances
     SET active_plan_id = NULL,
         is_unlimited = rfq_unlimited_override,
         monthly_quota = CASE WHEN rfq_unlimited_override THEN 0 ELSE 3 END,
         plan_expires_at = NULL
   WHERE user_id = _user_id
     AND plan_expires_at IS NOT NULL
     AND plan_expires_at < now();

  SELECT * INTO rec FROM public.rfq_buyer_balances WHERE user_id = _user_id;
  RETURN rec;
END;
$$;

-- ============================================
-- 7. rfq_check_quota
-- ============================================
CREATE OR REPLACE FUNCTION public.rfq_check_quota(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal public.rfq_buyer_balances;
  is_admin_flag boolean;
  monthly_remaining integer;
  total_remaining integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;

  is_admin_flag := public.is_admin(_user_id);

  INSERT INTO public.rfq_buyer_balances (user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO bal FROM public.rfq_buyer_balances WHERE user_id = _user_id;

  IF bal.current_period_start < date_trunc('month', now()) THEN
    monthly_remaining := bal.monthly_quota;
  ELSE
    monthly_remaining := GREATEST(0, bal.monthly_quota - bal.monthly_used);
  END IF;

  IF is_admin_flag OR bal.is_unlimited OR bal.rfq_unlimited_override THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'unlimited', true,
      'reason', CASE WHEN is_admin_flag THEN 'admin' ELSE 'unlimited_plan' END,
      'monthly_quota', bal.monthly_quota,
      'monthly_remaining', monthly_remaining,
      'permanent_credits', bal.permanent_credits,
      'active_plan_id', bal.active_plan_id,
      'plan_expires_at', bal.plan_expires_at
    );
  END IF;

  total_remaining := monthly_remaining + bal.permanent_credits;

  RETURN jsonb_build_object(
    'allowed', total_remaining > 0,
    'unlimited', false,
    'reason', CASE WHEN total_remaining > 0 THEN 'has_credits' ELSE 'no_credits' END,
    'monthly_quota', bal.monthly_quota,
    'monthly_remaining', monthly_remaining,
    'permanent_credits', bal.permanent_credits,
    'total_remaining', total_remaining,
    'active_plan_id', bal.active_plan_id,
    'plan_expires_at', bal.plan_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rfq_check_quota(uuid) TO authenticated, anon;

-- ============================================
-- 8. rfq_consume_credit
-- ============================================
CREATE OR REPLACE FUNCTION public.rfq_consume_credit(_user_id uuid, _rfq_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal public.rfq_buyer_balances;
  is_admin_flag boolean;
  monthly_remaining integer;
  consumed_from text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'rfq_consume: utilisateur non authentifié' USING ERRCODE = '28000';
  END IF;

  is_admin_flag := public.is_admin(_user_id);
  PERFORM public.rfq_ensure_buyer_balance(_user_id);
  SELECT * INTO bal FROM public.rfq_buyer_balances WHERE user_id = _user_id FOR UPDATE;

  IF is_admin_flag THEN
    consumed_from := 'admin';
  ELSIF bal.is_unlimited OR bal.rfq_unlimited_override THEN
    consumed_from := 'unlimited';
  ELSE
    monthly_remaining := GREATEST(0, bal.monthly_quota - bal.monthly_used);
    IF monthly_remaining > 0 THEN
      UPDATE public.rfq_buyer_balances
         SET monthly_used = monthly_used + 1,
             total_consumed = total_consumed + 1
       WHERE user_id = _user_id;
      consumed_from := 'monthly';
    ELSIF bal.permanent_credits > 0 THEN
      UPDATE public.rfq_buyer_balances
         SET permanent_credits = permanent_credits - 1,
             total_consumed = total_consumed + 1
       WHERE user_id = _user_id;
      consumed_from := 'permanent';
    ELSE
      RAISE EXCEPTION 'Crédits insuffisants pour créer une nouvelle demande de prix.'
        USING ERRCODE = 'P0001', HINT = 'rfq_no_credits';
    END IF;
  END IF;

  INSERT INTO public.rfq_credit_ledger (
    user_id, kind, delta_quota, delta_permanent, rfq_id, performed_by_user_id, reason, metadata
  ) VALUES (
    _user_id,
    'consume',
    CASE WHEN consumed_from = 'monthly' THEN -1 ELSE 0 END,
    CASE WHEN consumed_from = 'permanent' THEN -1 ELSE 0 END,
    _rfq_id,
    _user_id,
    CASE consumed_from
      WHEN 'admin' THEN 'Conso exemptée (admin)'
      WHEN 'unlimited' THEN 'Conso exemptée (forfait illimité)'
      WHEN 'monthly' THEN 'Conso quota mensuel'
      WHEN 'permanent' THEN 'Conso crédits achetés'
    END,
    jsonb_build_object('source', consumed_from)
  );

  RETURN jsonb_build_object('ok', true, 'consumed_from', consumed_from);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rfq_consume_credit(uuid, uuid) TO authenticated;

-- ============================================
-- 9. Trigger AFTER INSERT sur rfqs
-- ============================================
CREATE OR REPLACE FUNCTION public.rfq_consume_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.rfq_consume_credit(NEW.buyer_user_id, NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rfqs_consume_credit
  AFTER INSERT ON public.rfqs
  FOR EACH ROW EXECUTE FUNCTION public.rfq_consume_on_insert();

-- ============================================
-- 10. rfq_grant_credits (admin)
-- ============================================
CREATE OR REPLACE FUNCTION public.rfq_grant_credits(
  _user_id uuid,
  _plan_code text DEFAULT NULL,
  _extra_credits integer DEFAULT 0,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  plan public.rfq_plans;
  new_expires timestamptz;
BEGIN
  IF NOT public.is_admin(caller) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  PERFORM public.rfq_ensure_buyer_balance(_user_id);

  IF _plan_code IS NOT NULL THEN
    SELECT * INTO plan FROM public.rfq_plans WHERE code = _plan_code AND is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plan introuvable : %', _plan_code;
    END IF;

    new_expires := CASE WHEN plan.duration_days IS NOT NULL
                        THEN now() + make_interval(days => plan.duration_days)
                        ELSE NULL END;

    UPDATE public.rfq_buyer_balances
       SET monthly_quota = GREATEST(monthly_quota, plan.monthly_quota),
           permanent_credits = permanent_credits + plan.credits_included,
           is_unlimited = is_unlimited OR plan.is_unlimited,
           active_plan_id = CASE WHEN plan.plan_type IN ('monthly_plan', 'unlimited_plan') THEN plan.id ELSE active_plan_id END,
           plan_started_at = CASE WHEN plan.plan_type IN ('monthly_plan', 'unlimited_plan') THEN now() ELSE plan_started_at END,
           plan_expires_at = CASE WHEN plan.plan_type IN ('monthly_plan', 'unlimited_plan') THEN new_expires ELSE plan_expires_at END,
           total_purchased = total_purchased + plan.credits_included
     WHERE user_id = _user_id;

    INSERT INTO public.rfq_credit_ledger (
      user_id, kind, delta_quota, delta_permanent, plan_id, performed_by_user_id, reason, metadata
    ) VALUES (
      _user_id,
      CASE WHEN plan.plan_type = 'credit_pack' THEN 'purchase_pack' ELSE 'subscribe_plan' END,
      plan.monthly_quota,
      plan.credits_included,
      plan.id,
      caller,
      COALESCE(_reason, 'Octroi admin: ' || plan.label),
      jsonb_build_object('plan_code', plan.code, 'price_cents', plan.price_cents)
    );
  END IF;

  IF _extra_credits IS NOT NULL AND _extra_credits <> 0 THEN
    UPDATE public.rfq_buyer_balances
       SET permanent_credits = permanent_credits + _extra_credits,
           total_purchased = total_purchased + GREATEST(_extra_credits, 0)
     WHERE user_id = _user_id;

    INSERT INTO public.rfq_credit_ledger (
      user_id, kind, delta_permanent, performed_by_user_id, reason
    ) VALUES (
      _user_id, 'grant_admin', _extra_credits, caller,
      COALESCE(_reason, 'Ajustement manuel admin')
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rfq_grant_credits(uuid, text, integer, text) TO authenticated;

-- ============================================
-- 11. Reset mensuel (cron)
-- ============================================
CREATE OR REPLACE FUNCTION public.rfq_monthly_reset_quotas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reset_count integer := 0;
BEGIN
  UPDATE public.rfq_buyer_balances
     SET active_plan_id = NULL,
         is_unlimited = rfq_unlimited_override,
         monthly_quota = CASE WHEN rfq_unlimited_override THEN 0 ELSE 3 END,
         plan_expires_at = NULL
   WHERE plan_expires_at IS NOT NULL AND plan_expires_at < now();

  WITH updated AS (
    UPDATE public.rfq_buyer_balances
       SET monthly_used = 0,
           current_period_start = date_trunc('month', now())
     WHERE current_period_start < date_trunc('month', now())
     RETURNING user_id, monthly_quota
  )
  INSERT INTO public.rfq_credit_ledger (user_id, kind, delta_quota, reason)
  SELECT user_id, 'monthly_reset', monthly_quota, 'Reset mensuel automatique' FROM updated;

  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$;
