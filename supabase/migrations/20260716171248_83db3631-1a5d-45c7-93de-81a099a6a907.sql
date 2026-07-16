
-- ============================================================
-- INTELLIGENCE PAYWALL — Généralisation Veille marché + Analytics
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.intelligence_module AS ENUM ('veille_marche', 'analytics', 'bundle');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.intelligence_module_settings (
  module public.intelligence_module PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT true,
  default_trial_days integer NOT NULL DEFAULT 180,
  metric_kind text NOT NULL DEFAULT 'unlimited',
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.intelligence_module_settings TO authenticated;
GRANT ALL ON public.intelligence_module_settings TO service_role;
ALTER TABLE public.intelligence_module_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intel settings read authenticated" ON public.intelligence_module_settings;
CREATE POLICY "intel settings read authenticated" ON public.intelligence_module_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "intel settings admin manage" ON public.intelligence_module_settings;
CREATE POLICY "intel settings admin manage" ON public.intelligence_module_settings
  FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.intelligence_module_tab_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module public.intelligence_module NOT NULL,
  tab_key text NOT NULL,
  label text NOT NULL,
  is_free boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, tab_key)
);
GRANT SELECT ON public.intelligence_module_tab_flags TO authenticated;
GRANT ALL ON public.intelligence_module_tab_flags TO service_role;
ALTER TABLE public.intelligence_module_tab_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intel tab flags read authenticated" ON public.intelligence_module_tab_flags;
CREATE POLICY "intel tab flags read authenticated" ON public.intelligence_module_tab_flags
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "intel tab flags admin manage" ON public.intelligence_module_tab_flags;
CREATE POLICY "intel tab flags admin manage" ON public.intelligence_module_tab_flags
  FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.intelligence_bundle_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  is_enabled boolean NOT NULL DEFAULT false,
  bundle_plan_id uuid,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.intelligence_bundle_settings TO authenticated;
GRANT ALL ON public.intelligence_bundle_settings TO service_role;
ALTER TABLE public.intelligence_bundle_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intel bundle read authenticated" ON public.intelligence_bundle_settings;
CREATE POLICY "intel bundle read authenticated" ON public.intelligence_bundle_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "intel bundle admin manage" ON public.intelligence_bundle_settings;
CREATE POLICY "intel bundle admin manage" ON public.intelligence_bundle_settings
  FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

INSERT INTO public.intelligence_bundle_settings (id, is_enabled) VALUES (true, false)
  ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.vendor_intelligence_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module public.intelligence_module NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  description text,
  monthly_price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  metric_config jsonb NOT NULL DEFAULT '{"kind":"unlimited"}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  stripe_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, code)
);
GRANT SELECT ON public.vendor_intelligence_plans TO authenticated;
GRANT ALL ON public.vendor_intelligence_plans TO service_role;
ALTER TABLE public.vendor_intelligence_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intel plans read" ON public.vendor_intelligence_plans;
CREATE POLICY "intel plans read" ON public.vendor_intelligence_plans
  FOR SELECT TO authenticated
  USING (is_active OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "intel plans admin manage" ON public.vendor_intelligence_plans;
CREATE POLICY "intel plans admin manage" ON public.vendor_intelligence_plans
  FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.vendor_intelligence_entitlements (
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  module public.intelligence_module NOT NULL,
  status public.vendor_market_intel_status NOT NULL DEFAULT 'none',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  subscription_started_at timestamptz,
  subscription_current_period_end timestamptz,
  plan_id uuid REFERENCES public.vendor_intelligence_plans(id),
  billing_method public.vendor_market_intel_billing,
  stripe_subscription_id text,
  granted_by uuid,
  granted_reason text,
  is_permanent boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vendor_id, module)
);
CREATE INDEX IF NOT EXISTS idx_intel_ent_module_status ON public.vendor_intelligence_entitlements (module, status);
CREATE INDEX IF NOT EXISTS idx_intel_ent_trial_ends ON public.vendor_intelligence_entitlements (trial_ends_at);
GRANT SELECT ON public.vendor_intelligence_entitlements TO authenticated;
GRANT ALL ON public.vendor_intelligence_entitlements TO service_role;
ALTER TABLE public.vendor_intelligence_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intel ent vendor reads own" ON public.vendor_intelligence_entitlements;
CREATE POLICY "intel ent vendor reads own" ON public.vendor_intelligence_entitlements
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "intel ent admin manage" ON public.vendor_intelligence_entitlements;
CREATE POLICY "intel ent admin manage" ON public.vendor_intelligence_entitlements
  FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.intelligence_entitlement_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
      IF NEW.status IS DISTINCT FROM OLD.status
         OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
         OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
         OR NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end
         OR NEW.is_permanent IS DISTINCT FROM OLD.is_permanent
      THEN
        RAISE EXCEPTION 'protected_columns_admin_only' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_intel_ent_guard ON public.vendor_intelligence_entitlements;
CREATE TRIGGER trg_intel_ent_guard
  BEFORE UPDATE ON public.vendor_intelligence_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.intelligence_entitlement_guard();

CREATE TABLE IF NOT EXISTS public.vendor_intelligence_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  module public.intelligence_module NOT NULL,
  kind text NOT NULL CHECK (kind IN ('trial_renewal','support','activation')),
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','handled','dismissed')),
  created_by uuid,
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intel_req_status ON public.vendor_intelligence_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_req_vendor ON public.vendor_intelligence_requests (vendor_id, module);
GRANT SELECT ON public.vendor_intelligence_requests TO authenticated;
GRANT ALL ON public.vendor_intelligence_requests TO service_role;
ALTER TABLE public.vendor_intelligence_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intel req vendor reads own" ON public.vendor_intelligence_requests;
CREATE POLICY "intel req vendor reads own" ON public.vendor_intelligence_requests
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "intel req admin manage" ON public.vendor_intelligence_requests;
CREATE POLICY "intel req admin manage" ON public.vendor_intelligence_requests
  FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

INSERT INTO public.intelligence_module_settings (module, default_trial_days, metric_kind, label, description) VALUES
  ('veille_marche', 180, 'ean_quota', 'Veille marché', 'Classement EAN, comparaison concurrentielle, alertes prix.'),
  ('analytics', 180, 'monthly_gmv_cents', 'Analytics ventes', 'KPIs, typologie clients, cohortes, sell-in vs sell-out, couverture BE.')
ON CONFLICT (module) DO UPDATE SET
  label = EXCLUDED.label, description = EXCLUDED.description,
  metric_kind = EXCLUDED.metric_kind, updated_at = now();

INSERT INTO public.intelligence_module_tab_flags (module, tab_key, label, is_free, sort_order) VALUES
  ('analytics','overview','Vue d''ensemble',false,1),
  ('analytics','typology','Typologie clients',false,2),
  ('analytics','recurrence','Récurrence & cohortes',false,3),
  ('analytics','customers','Top clients',false,4),
  ('analytics','map','Carte clients',false,5),
  ('analytics','products','Top produits',false,6),
  ('analytics','sellin_manual','Sell-in manuel',false,7),
  ('analytics','sellout','Sell-in vs Sell-out',false,8),
  ('analytics','coverage_be','Couverture BE',false,9)
ON CONFLICT (module, tab_key) DO NOTHING;

INSERT INTO public.vendor_intelligence_plans
  (id, module, code, label, description, monthly_price_cents, currency,
   metric_config, is_active, sort_order, stripe_price_id, created_at, updated_at)
SELECT
  id, 'veille_marche'::public.intelligence_module,
  code, label, description, monthly_price_cents, currency,
  CASE WHEN ean_quota IS NULL
       THEN '{"kind":"unlimited"}'::jsonb
       ELSE jsonb_build_object('kind','ean_quota','threshold', ean_quota, 'label_suffix', ean_quota||' EAN suivis') END,
  is_active, sort_order, stripe_price_id, created_at, updated_at
FROM public.vendor_market_intel_plans
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vendor_intelligence_plans
  (module, code, label, description, monthly_price_cents, currency, metric_config, sort_order)
VALUES
  ('analytics','starter','Starter','Petits volumes',2900,'EUR',
    jsonb_build_object('kind','monthly_gmv_cents','threshold',1500000,'label_suffix','< 15 000 €/mois'),1),
  ('analytics','pro','Pro','Croissance',7900,'EUR',
    jsonb_build_object('kind','monthly_gmv_cents','threshold',5000000,'label_suffix','15 000 € à 50 000 €/mois'),2),
  ('analytics','premium','Premium','Illimité',19900,'EUR',
    jsonb_build_object('kind','unlimited','label_suffix','> 50 000 €/mois — illimité'),3)
ON CONFLICT (module, code) DO NOTHING;

INSERT INTO public.vendor_intelligence_entitlements
  (vendor_id, module, status, trial_started_at, trial_ends_at,
   subscription_started_at, subscription_current_period_end, plan_id,
   billing_method, stripe_subscription_id, granted_by, notes, created_at, updated_at)
SELECT
  vendor_id, 'veille_marche'::public.intelligence_module, status,
  trial_started_at, trial_ends_at,
  subscription_started_at, subscription_current_period_end, plan_id,
  billing_method, stripe_subscription_id, granted_by, notes, created_at, updated_at
FROM public.vendor_market_intel_entitlements
ON CONFLICT (vendor_id, module) DO NOTHING;

INSERT INTO public.vendor_intelligence_entitlements
  (vendor_id, module, status, trial_started_at, trial_ends_at, granted_by, granted_reason, notes)
SELECT DISTINCT
  ol.vendor_id,
  'analytics'::public.intelligence_module,
  'trial'::public.vendor_market_intel_status,
  now(), now() + interval '180 days',
  NULL::uuid, 'backfill_active_vendors_90d',
  'Auto-attribué au déploiement Analytics paywall (order_lines 90j)'
FROM public.order_lines ol
WHERE ol.vendor_id IS NOT NULL
  AND ol.updated_at > now() - interval '90 days'
ON CONFLICT (vendor_id, module) DO NOTHING;

CREATE OR REPLACE FUNCTION public.intelligence_access(_vendor_id uuid, _module public.intelligence_module)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH b AS (SELECT is_enabled FROM public.intelligence_bundle_settings WHERE id = true LIMIT 1)
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_intelligence_entitlements e
    WHERE e.vendor_id = _vendor_id
      AND (
        e.module = _module
        OR (e.module = 'bundle'::public.intelligence_module AND (SELECT is_enabled FROM b))
      )
      AND (
        e.is_permanent = true
        OR (e.status = 'trial'  AND e.trial_ends_at IS NOT NULL AND e.trial_ends_at > now())
        OR (e.status = 'active' AND (e.subscription_current_period_end IS NULL OR e.subscription_current_period_end > now()))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.intelligence_start_trial(_module public.intelligence_module)
RETURNS public.vendor_intelligence_entitlements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _vendor_id uuid; _existing public.vendor_intelligence_entitlements;
  _row public.vendor_intelligence_entitlements; _trial_days integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT id INTO _vendor_id FROM public.vendors WHERE auth_user_id = auth.uid() LIMIT 1;
  IF _vendor_id IS NULL THEN RAISE EXCEPTION 'No vendor account linked' USING ERRCODE = '42501'; END IF;

  SELECT default_trial_days INTO _trial_days FROM public.intelligence_module_settings WHERE module = _module;
  IF _trial_days IS NULL THEN _trial_days := 180; END IF;

  SELECT * INTO _existing FROM public.vendor_intelligence_entitlements
    WHERE vendor_id = _vendor_id AND module = _module;
  IF FOUND AND _existing.trial_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'trial_already_used' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.vendor_intelligence_entitlements
    (vendor_id, module, status, trial_started_at, trial_ends_at, granted_by, granted_reason, notes)
  VALUES
    (_vendor_id, _module, 'trial', now(),
     now() + make_interval(days => _trial_days),
     auth.uid(), 'self_activated', 'self_activated')
  ON CONFLICT (vendor_id, module) DO UPDATE SET
    status = 'trial',
    trial_started_at = now(),
    trial_ends_at = now() + make_interval(days => _trial_days),
    granted_by = auth.uid(),
    granted_reason = COALESCE(public.vendor_intelligence_entitlements.granted_reason, 'self_activated')
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (user_id, action, module, detail)
  VALUES (auth.uid(), 'intelligence.trial_self_started', _module::text,
          jsonb_build_object('vendor_id', _vendor_id, 'module', _module, 'ends_at', _row.trial_ends_at)::text);
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.intelligence_request_renewal(_module public.intelligence_module, _message text DEFAULT NULL)
RETURNS public.vendor_intelligence_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _vendor_id uuid; _row public.vendor_intelligence_requests; _existing_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT id INTO _vendor_id FROM public.vendors WHERE auth_user_id = auth.uid() LIMIT 1;
  IF _vendor_id IS NULL THEN RAISE EXCEPTION 'No vendor account linked' USING ERRCODE = '42501'; END IF;

  SELECT id INTO _existing_id FROM public.vendor_intelligence_requests
    WHERE vendor_id = _vendor_id AND module = _module
      AND kind = 'trial_renewal' AND status = 'pending' LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'request_already_pending' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.vendor_intelligence_requests
    (vendor_id, module, kind, message, created_by)
  VALUES (_vendor_id, _module, 'trial_renewal', _message, auth.uid())
  RETURNING * INTO _row;
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.intelligence_grant(
  _vendor_id uuid,
  _module public.intelligence_module,
  _plan_id uuid DEFAULT NULL,
  _is_permanent boolean DEFAULT false,
  _trial_days integer DEFAULT NULL,
  _billing_method public.vendor_market_intel_billing DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS public.vendor_intelligence_entitlements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.vendor_intelligence_entitlements; _new_status public.vendor_market_intel_status;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  _new_status := CASE
    WHEN _is_permanent THEN 'active'::public.vendor_market_intel_status
    WHEN _plan_id IS NOT NULL THEN 'active'::public.vendor_market_intel_status
    ELSE 'trial'::public.vendor_market_intel_status
  END;

  INSERT INTO public.vendor_intelligence_entitlements
    (vendor_id, module, status,
     trial_started_at, trial_ends_at,
     subscription_started_at, subscription_current_period_end,
     plan_id, billing_method, granted_by, is_permanent, notes, granted_reason)
  VALUES (
    _vendor_id, _module, _new_status,
    CASE WHEN _plan_id IS NULL AND NOT _is_permanent THEN now() ELSE NULL END,
    CASE WHEN _plan_id IS NULL AND NOT _is_permanent
         THEN now() + make_interval(days => COALESCE(_trial_days, 180)) ELSE NULL END,
    CASE WHEN _plan_id IS NOT NULL THEN now() ELSE NULL END,
    CASE WHEN _plan_id IS NOT NULL THEN now() + interval '30 days' ELSE NULL END,
    _plan_id, _billing_method, auth.uid(), COALESCE(_is_permanent,false), _notes,
    CASE WHEN _is_permanent THEN 'admin_permanent'
         WHEN _plan_id IS NOT NULL THEN 'admin_subscription'
         ELSE 'admin_trial' END
  )
  ON CONFLICT (vendor_id, module) DO UPDATE SET
    status = EXCLUDED.status,
    trial_started_at = COALESCE(EXCLUDED.trial_started_at, public.vendor_intelligence_entitlements.trial_started_at),
    trial_ends_at = COALESCE(EXCLUDED.trial_ends_at, public.vendor_intelligence_entitlements.trial_ends_at),
    subscription_started_at = COALESCE(EXCLUDED.subscription_started_at, public.vendor_intelligence_entitlements.subscription_started_at),
    subscription_current_period_end = COALESCE(EXCLUDED.subscription_current_period_end, public.vendor_intelligence_entitlements.subscription_current_period_end),
    plan_id = COALESCE(EXCLUDED.plan_id, public.vendor_intelligence_entitlements.plan_id),
    billing_method = COALESCE(EXCLUDED.billing_method, public.vendor_intelligence_entitlements.billing_method),
    is_permanent = EXCLUDED.is_permanent,
    notes = COALESCE(EXCLUDED.notes, public.vendor_intelligence_entitlements.notes),
    granted_by = auth.uid(),
    granted_reason = EXCLUDED.granted_reason
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (user_id, action, module, detail)
  VALUES (auth.uid(), 'intelligence.grant', _module::text,
          jsonb_build_object('vendor_id', _vendor_id, 'module', _module,
                             'plan_id', _plan_id, 'permanent', _is_permanent)::text);
  RETURN _row;
END $$;

DROP VIEW IF EXISTS public.vendor_intelligence_status_v CASCADE;
CREATE VIEW public.vendor_intelligence_status_v
WITH (security_invoker = true) AS
SELECT
  v.id AS vendor_id,
  v.name AS vendor_name,
  m.module,
  COALESCE(e.status, 'none'::public.vendor_market_intel_status) AS status,
  e.trial_started_at,
  e.trial_ends_at,
  CASE WHEN e.status = 'trial' AND e.trial_ends_at IS NOT NULL
       THEN GREATEST(0, EXTRACT(epoch FROM e.trial_ends_at - now())/86400)::integer
       ELSE NULL END AS trial_days_remaining,
  e.subscription_started_at,
  e.subscription_current_period_end,
  e.plan_id,
  p.code AS plan_code,
  p.label AS plan_label,
  p.monthly_price_cents,
  p.metric_config,
  e.billing_method,
  e.stripe_subscription_id,
  e.is_permanent,
  e.granted_reason,
  public.intelligence_access(v.id, m.module) AS has_access
FROM public.vendors v
CROSS JOIN (VALUES
  ('veille_marche'::public.intelligence_module),
  ('analytics'::public.intelligence_module)
) AS m(module)
LEFT JOIN public.vendor_intelligence_entitlements e
  ON e.vendor_id = v.id AND e.module = m.module
LEFT JOIN public.vendor_intelligence_plans p ON p.id = e.plan_id;

GRANT SELECT ON public.vendor_intelligence_status_v TO authenticated;

DROP VIEW IF EXISTS public.vendor_market_intel_status_v CASCADE;
CREATE VIEW public.vendor_market_intel_status_v
WITH (security_invoker = true) AS
SELECT
  vendor_id, vendor_name, status,
  trial_started_at, trial_ends_at, trial_days_remaining,
  subscription_started_at, subscription_current_period_end,
  plan_id, plan_code, plan_label, monthly_price_cents,
  CASE WHEN metric_config->>'kind' = 'ean_quota'
       THEN (metric_config->>'threshold')::integer
       ELSE NULL END AS ean_quota,
  billing_method, stripe_subscription_id, has_access
FROM public.vendor_intelligence_status_v
WHERE module = 'veille_marche'::public.intelligence_module;

GRANT SELECT ON public.vendor_market_intel_status_v TO authenticated;

CREATE OR REPLACE FUNCTION public.self_start_vendor_market_intel_trial()
RETURNS public.vendor_market_intel_entitlements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new public.vendor_intelligence_entitlements; _out public.vendor_market_intel_entitlements;
BEGIN
  _new := public.intelligence_start_trial('veille_marche'::public.intelligence_module);
  INSERT INTO public.vendor_market_intel_entitlements
    (vendor_id, status, trial_started_at, trial_ends_at, granted_by, notes)
  VALUES (_new.vendor_id, _new.status, _new.trial_started_at, _new.trial_ends_at, _new.granted_by, _new.notes)
  ON CONFLICT (vendor_id) DO UPDATE SET
    status = EXCLUDED.status,
    trial_started_at = EXCLUDED.trial_started_at,
    trial_ends_at = EXCLUDED.trial_ends_at,
    granted_by = EXCLUDED.granted_by,
    notes = EXCLUDED.notes
  RETURNING * INTO _out;
  RETURN _out;
END $$;

CREATE OR REPLACE FUNCTION public.start_vendor_market_intel_trial(_vendor_id uuid, _trial_days integer DEFAULT 180, _notes text DEFAULT NULL::text)
RETURNS public.vendor_market_intel_entitlements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new public.vendor_intelligence_entitlements; _out public.vendor_market_intel_entitlements;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Admin only'; END IF;
  IF _trial_days IS NULL OR _trial_days <= 0 THEN
    RAISE EXCEPTION 'Trial duration must be positive'; END IF;

  _new := public.intelligence_grant(_vendor_id, 'veille_marche'::public.intelligence_module,
                                     NULL, false, _trial_days, NULL, _notes);
  INSERT INTO public.vendor_market_intel_entitlements
    (vendor_id, status, trial_started_at, trial_ends_at, granted_by, notes)
  VALUES (_new.vendor_id, _new.status, _new.trial_started_at, _new.trial_ends_at, _new.granted_by, _new.notes)
  ON CONFLICT (vendor_id) DO UPDATE SET
    status = EXCLUDED.status,
    trial_started_at = EXCLUDED.trial_started_at,
    trial_ends_at = EXCLUDED.trial_ends_at,
    granted_by = EXCLUDED.granted_by,
    notes = COALESCE(EXCLUDED.notes, public.vendor_market_intel_entitlements.notes)
  RETURNING * INTO _out;
  RETURN _out;
END $$;

CREATE OR REPLACE FUNCTION public.activate_vendor_market_intel_subscription(
  _vendor_id uuid, _plan_id uuid,
  _billing_method public.vendor_market_intel_billing,
  _stripe_subscription_id text DEFAULT NULL::text,
  _period_end timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS public.vendor_market_intel_entitlements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new public.vendor_intelligence_entitlements; _out public.vendor_market_intel_entitlements;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Admin only'; END IF;

  _new := public.intelligence_grant(_vendor_id, 'veille_marche'::public.intelligence_module,
                                     _plan_id, false, NULL, _billing_method, NULL);
  IF _period_end IS NOT NULL OR _stripe_subscription_id IS NOT NULL THEN
    UPDATE public.vendor_intelligence_entitlements
       SET subscription_current_period_end = COALESCE(_period_end, subscription_current_period_end),
           stripe_subscription_id = COALESCE(_stripe_subscription_id, stripe_subscription_id)
     WHERE vendor_id = _vendor_id AND module = 'veille_marche'::public.intelligence_module
     RETURNING * INTO _new;
  END IF;

  INSERT INTO public.vendor_market_intel_entitlements
    (vendor_id, status, plan_id, billing_method, stripe_subscription_id,
     subscription_started_at, subscription_current_period_end)
  VALUES (_new.vendor_id, 'active', _new.plan_id, _new.billing_method,
          _new.stripe_subscription_id, _new.subscription_started_at, _new.subscription_current_period_end)
  ON CONFLICT (vendor_id) DO UPDATE SET
    status = 'active',
    plan_id = EXCLUDED.plan_id,
    billing_method = EXCLUDED.billing_method,
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, public.vendor_market_intel_entitlements.stripe_subscription_id),
    subscription_started_at = COALESCE(public.vendor_market_intel_entitlements.subscription_started_at, EXCLUDED.subscription_started_at),
    subscription_current_period_end = EXCLUDED.subscription_current_period_end
  RETURNING * INTO _out;
  RETURN _out;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_vendor_market_intel_subscription(_vendor_id uuid)
RETURNS public.vendor_market_intel_entitlements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _out public.vendor_market_intel_entitlements;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Admin only'; END IF;

  UPDATE public.vendor_intelligence_entitlements
     SET status = 'cancelled', subscription_current_period_end = now()
   WHERE vendor_id = _vendor_id AND module = 'veille_marche'::public.intelligence_module;

  UPDATE public.vendor_market_intel_entitlements
     SET status = 'cancelled', subscription_current_period_end = now()
   WHERE vendor_id = _vendor_id
   RETURNING * INTO _out;

  INSERT INTO public.audit_logs (user_id, action, module, detail)
  VALUES (auth.uid(), 'intelligence.cancel', 'veille_marche',
          jsonb_build_object('vendor_id', _vendor_id)::text);
  RETURN _out;
END $$;

CREATE OR REPLACE FUNCTION public.request_vendor_market_intel_trial_renewal(_message text DEFAULT NULL::text)
RETURNS public.vendor_market_intel_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new public.vendor_intelligence_requests; _out public.vendor_market_intel_requests;
BEGIN
  _new := public.intelligence_request_renewal('veille_marche'::public.intelligence_module, _message);
  INSERT INTO public.vendor_market_intel_requests (id, vendor_id, kind, message, status, created_by, created_at)
  VALUES (_new.id, _new.vendor_id, _new.kind, _new.message, _new.status, _new.created_by, _new.created_at)
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO _out;
  IF _out.id IS NULL THEN
    SELECT * INTO _out FROM public.vendor_market_intel_requests WHERE id = _new.id;
  END IF;
  RETURN _out;
END $$;

CREATE OR REPLACE FUNCTION public.expire_intelligence_trials()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.vendor_intelligence_entitlements
     SET status = 'expired'
   WHERE status = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at < now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;
