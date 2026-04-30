-- Plans (paliers tarifaires) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_market_intel_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  monthly_price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  ean_quota integer,                       -- NULL = illimité
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  stripe_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_market_intel_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans readable by all" ON public.vendor_market_intel_plans;
CREATE POLICY "plans readable by all"
  ON public.vendor_market_intel_plans FOR SELECT
  USING (is_active = true OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "plans admin manage" ON public.vendor_market_intel_plans;
CREATE POLICY "plans admin manage"
  ON public.vendor_market_intel_plans FOR ALL
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- Seed des 3 paliers
INSERT INTO public.vendor_market_intel_plans (code, label, description, monthly_price_cents, ean_quota, sort_order) VALUES
  ('starter', 'Starter', 'Idéal pour débuter — 200 EAN suivis', 2900, 200, 1),
  ('pro',     'Pro',     'Pour les pharmacies actives — 1000 EAN suivis', 7900, 1000, 2),
  ('premium', 'Premium', 'EAN illimités + alertes prioritaires', 19900, NULL, 3)
ON CONFLICT (code) DO NOTHING;

-- Entitlements (état par vendeur) ────────────────────────────────────
CREATE TYPE public.vendor_market_intel_status AS ENUM ('none','trial','active','expired','cancelled');
CREATE TYPE public.vendor_market_intel_billing AS ENUM ('stripe','medikong_invoice');

CREATE TABLE IF NOT EXISTS public.vendor_market_intel_entitlements (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  status public.vendor_market_intel_status NOT NULL DEFAULT 'none',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  subscription_started_at timestamptz,
  subscription_current_period_end timestamptz,
  plan_id uuid REFERENCES public.vendor_market_intel_plans(id),
  billing_method public.vendor_market_intel_billing,
  stripe_subscription_id text,
  granted_by uuid,                              -- admin qui a démarré l'essai
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vmi_entitlements_status ON public.vendor_market_intel_entitlements(status);
CREATE INDEX IF NOT EXISTS idx_vmi_entitlements_trial_ends ON public.vendor_market_intel_entitlements(trial_ends_at);

ALTER TABLE public.vendor_market_intel_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor reads own entitlement" ON public.vendor_market_intel_entitlements;
CREATE POLICY "vendor reads own entitlement"
  ON public.vendor_market_intel_entitlements FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid())
    OR is_admin(auth.uid()) OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "admin manages entitlements" ON public.vendor_market_intel_entitlements;
CREATE POLICY "admin manages entitlements"
  ON public.vendor_market_intel_entitlements FOR ALL
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_vmi_entitlement()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_vmi_entitlement ON public.vendor_market_intel_entitlements;
CREATE TRIGGER trg_touch_vmi_entitlement
  BEFORE UPDATE ON public.vendor_market_intel_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_vmi_entitlement();

-- Fonction de check d'accès (utilisée par le front + RLS éventuelles) ──
CREATE OR REPLACE FUNCTION public.vendor_market_intel_access(_vendor_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_market_intel_entitlements e
    WHERE e.vendor_id = _vendor_id
      AND (
        (e.status = 'trial'  AND e.trial_ends_at IS NOT NULL AND e.trial_ends_at > now())
        OR
        (e.status = 'active' AND (e.subscription_current_period_end IS NULL OR e.subscription_current_period_end > now()))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.vendor_market_intel_access(uuid) TO authenticated;

-- Vue de statut consolidée pour l'UI vendeur ─────────────────────────
CREATE OR REPLACE VIEW public.vendor_market_intel_status_v
WITH (security_invoker = true) AS
SELECT
  v.id AS vendor_id,
  v.name AS vendor_name,
  COALESCE(e.status, 'none'::public.vendor_market_intel_status) AS status,
  e.trial_started_at,
  e.trial_ends_at,
  CASE
    WHEN e.status = 'trial' AND e.trial_ends_at IS NOT NULL
      THEN GREATEST(0, EXTRACT(EPOCH FROM (e.trial_ends_at - now())) / 86400)::int
    ELSE NULL
  END AS trial_days_remaining,
  e.subscription_started_at,
  e.subscription_current_period_end,
  e.plan_id,
  p.code AS plan_code,
  p.label AS plan_label,
  p.monthly_price_cents,
  p.ean_quota,
  e.billing_method,
  e.stripe_subscription_id,
  public.vendor_market_intel_access(v.id) AS has_access
FROM public.vendors v
LEFT JOIN public.vendor_market_intel_entitlements e ON e.vendor_id = v.id
LEFT JOIN public.vendor_market_intel_plans p ON p.id = e.plan_id;

GRANT SELECT ON public.vendor_market_intel_status_v TO authenticated, anon;

-- Actions admin ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.start_vendor_market_intel_trial(_vendor_id uuid, _trial_days integer DEFAULT 180, _notes text DEFAULT NULL)
RETURNS public.vendor_market_intel_entitlements
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.vendor_market_intel_entitlements;
BEGIN
  IF NOT (is_admin(auth.uid()) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF _trial_days IS NULL OR _trial_days <= 0 THEN
    RAISE EXCEPTION 'Trial duration must be positive';
  END IF;

  INSERT INTO public.vendor_market_intel_entitlements
    (vendor_id, status, trial_started_at, trial_ends_at, granted_by, notes)
  VALUES
    (_vendor_id, 'trial', now(), now() + make_interval(days => _trial_days), auth.uid(), _notes)
  ON CONFLICT (vendor_id) DO UPDATE SET
    status = 'trial',
    trial_started_at = now(),
    trial_ends_at = now() + make_interval(days => _trial_days),
    granted_by = auth.uid(),
    notes = COALESCE(EXCLUDED.notes, public.vendor_market_intel_entitlements.notes)
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), 'vmi.trial_started', 'vendor', _vendor_id::text,
          jsonb_build_object('trial_days', _trial_days, 'ends_at', _row.trial_ends_at));

  RETURN _row;
END $$;

GRANT EXECUTE ON FUNCTION public.start_vendor_market_intel_trial(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_vendor_market_intel_subscription(
  _vendor_id uuid,
  _plan_id uuid,
  _billing_method public.vendor_market_intel_billing,
  _stripe_subscription_id text DEFAULT NULL,
  _period_end timestamptz DEFAULT NULL
)
RETURNS public.vendor_market_intel_entitlements
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.vendor_market_intel_entitlements;
BEGIN
  IF NOT (is_admin(auth.uid()) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  INSERT INTO public.vendor_market_intel_entitlements
    (vendor_id, status, plan_id, billing_method, stripe_subscription_id,
     subscription_started_at, subscription_current_period_end)
  VALUES
    (_vendor_id, 'active', _plan_id, _billing_method, _stripe_subscription_id,
     now(), COALESCE(_period_end, now() + interval '30 days'))
  ON CONFLICT (vendor_id) DO UPDATE SET
    status = 'active',
    plan_id = _plan_id,
    billing_method = _billing_method,
    stripe_subscription_id = COALESCE(_stripe_subscription_id, public.vendor_market_intel_entitlements.stripe_subscription_id),
    subscription_started_at = COALESCE(public.vendor_market_intel_entitlements.subscription_started_at, now()),
    subscription_current_period_end = COALESCE(_period_end, now() + interval '30 days')
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), 'vmi.subscription_activated', 'vendor', _vendor_id::text,
          jsonb_build_object('plan_id', _plan_id, 'billing', _billing_method));

  RETURN _row;
END $$;

GRANT EXECUTE ON FUNCTION public.activate_vendor_market_intel_subscription(uuid, uuid, public.vendor_market_intel_billing, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_vendor_market_intel_subscription(_vendor_id uuid)
RETURNS public.vendor_market_intel_entitlements
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.vendor_market_intel_entitlements;
BEGIN
  IF NOT (is_admin(auth.uid()) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE public.vendor_market_intel_entitlements
  SET status = 'cancelled',
      subscription_current_period_end = now()
  WHERE vendor_id = _vendor_id
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), 'vmi.subscription_cancelled', 'vendor', _vendor_id::text, '{}'::jsonb);

  RETURN _row;
END $$;

GRANT EXECUTE ON FUNCTION public.cancel_vendor_market_intel_subscription(uuid) TO authenticated;

-- Cron horaire : passe en 'expired' les essais terminés sans abonnement
CREATE OR REPLACE FUNCTION public.expire_vendor_market_intel_trials()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.vendor_market_intel_entitlements
  SET status = 'expired'
  WHERE status = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at <= now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('expire-vmi-trials-hourly') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'expire-vmi-trials-hourly'
    );
    PERFORM cron.schedule(
      'expire-vmi-trials-hourly',
      '7 * * * *',
      $cron$ SELECT public.expire_vendor_market_intel_trials(); $cron$
    );
  END IF;
END $$;