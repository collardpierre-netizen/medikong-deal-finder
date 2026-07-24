
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_founder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS founder_since timestamptz,
  ADD COLUMN IF NOT EXISTS founder_source text,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_is_founder ON public.profiles(is_founder) WHERE is_founder = true;

CREATE TABLE IF NOT EXISTS public.tracking_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  owner_type    text NOT NULL CHECK (owner_type IN ('vendor','brand','manufacturer','medikong','partner')),
  owner_id      uuid,
  partner_label text,
  landing_path  text NOT NULL DEFAULT '/inscription',
  utm_source    text,
  utm_medium    text NOT NULL DEFAULT 'qr',
  utm_campaign  text,
  utm_content   text,
  default_activation_code_id uuid,
  starts_at     timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused','ended')),
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_campaigns TO authenticated;
GRANT ALL ON public.tracking_campaigns TO service_role;

CREATE INDEX IF NOT EXISTS idx_tracking_campaigns_owner ON public.tracking_campaigns (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_tracking_campaigns_slug  ON public.tracking_campaigns (slug);
CREATE INDEX IF NOT EXISTS idx_tracking_campaigns_status ON public.tracking_campaigns (status);

ALTER TABLE public.tracking_campaigns ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_owns_tracking_campaign(_owner_type text, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _owner_type = 'vendor' AND _owner_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.vendors v WHERE v.id = _owner_id AND v.auth_user_id = auth.uid()
    )
    ELSE false
  END;
$$;

CREATE POLICY "tracking_campaigns_admin_all" ON public.tracking_campaigns
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "tracking_campaigns_owner_read" ON public.tracking_campaigns
  FOR SELECT TO authenticated
  USING (public.user_owns_tracking_campaign(owner_type, owner_id));

CREATE POLICY "tracking_campaigns_owner_update" ON public.tracking_campaigns
  FOR UPDATE TO authenticated
  USING (public.user_owns_tracking_campaign(owner_type, owner_id))
  WITH CHECK (public.user_owns_tracking_campaign(owner_type, owner_id));

CREATE TABLE IF NOT EXISTS public.activation_code_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid REFERENCES public.tracking_campaigns(id) ON DELETE SET NULL,
  name          text NOT NULL,
  quantity      int NOT NULL CHECK (quantity BETWEEN 1 AND 100000),
  benefits      jsonb,
  prefix        text NOT NULL DEFAULT 'MK',
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activation_code_batches TO authenticated;
GRANT ALL ON public.activation_code_batches TO service_role;
ALTER TABLE public.activation_code_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activation_code_batches_admin_all" ON public.activation_code_batches
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "activation_code_batches_owner_read" ON public.activation_code_batches
  FOR SELECT TO authenticated
  USING (campaign_id IN (
    SELECT id FROM public.tracking_campaigns
    WHERE public.user_owns_tracking_campaign(owner_type, owner_id)
  ));

CREATE TABLE IF NOT EXISTS public.activation_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    uuid REFERENCES public.tracking_campaigns(id) ON DELETE SET NULL,
  batch_id       uuid REFERENCES public.activation_code_batches(id) ON DELETE CASCADE,
  code           text NOT NULL,
  code_kind      text NOT NULL CHECK (code_kind IN ('shared','unique')),
  owner_type     text CHECK (owner_type IN ('vendor','brand','manufacturer','medikong','partner')),
  owner_id       uuid,
  benefits       jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_redemptions int,
  redeemed_count int NOT NULL DEFAULT 0,
  starts_at      timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz,
  is_active      boolean NOT NULL DEFAULT true,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_kind_single_use CHECK (code_kind <> 'unique' OR max_redemptions = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS activation_codes_code_ci ON public.activation_codes (lower(code));
CREATE INDEX IF NOT EXISTS idx_activation_codes_campaign ON public.activation_codes (campaign_id);
CREATE INDEX IF NOT EXISTS idx_activation_codes_batch ON public.activation_codes (batch_id);
CREATE INDEX IF NOT EXISTS idx_activation_codes_owner ON public.activation_codes (owner_type, owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activation_codes TO authenticated;
GRANT ALL ON public.activation_codes TO service_role;
ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activation_codes_admin_all" ON public.activation_codes
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "activation_codes_owner_read" ON public.activation_codes
  FOR SELECT TO authenticated
  USING (
    (campaign_id IS NOT NULL AND campaign_id IN (
      SELECT id FROM public.tracking_campaigns
      WHERE public.user_owns_tracking_campaign(owner_type, owner_id)
    ))
    OR
    (campaign_id IS NULL AND owner_type IS NOT NULL
     AND public.user_owns_tracking_campaign(owner_type, owner_id))
  );

ALTER TABLE public.tracking_campaigns
  ADD CONSTRAINT tracking_campaigns_default_code_fk
  FOREIGN KEY (default_activation_code_id) REFERENCES public.activation_codes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.tracking_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id   uuid REFERENCES public.tracking_campaigns(id) ON DELETE SET NULL,
  code_id       uuid REFERENCES public.activation_codes(id) ON DELETE SET NULL,
  event_type    text NOT NULL CHECK (event_type IN
      ('scan','visit','signup_started','signup_completed','code_redeemed','activated','first_purchase')),
  visitor_id    text,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_prefix     text,
  ua_family     text,
  referrer_host text,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracking_events_campaign ON public.tracking_events (campaign_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_tracking_events_visitor ON public.tracking_events (visitor_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_user ON public.tracking_events (user_id);
GRANT SELECT ON public.tracking_events TO authenticated;
GRANT ALL ON public.tracking_events TO service_role;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tracking_events_admin_read" ON public.tracking_events
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.code_redemptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id            uuid NOT NULL REFERENCES public.activation_codes(id),
  campaign_id        uuid REFERENCES public.tracking_campaigns(id),
  user_id            uuid NOT NULL REFERENCES auth.users(id),
  benefits_snapshot  jsonb NOT NULL,
  founder_granted    boolean NOT NULL DEFAULT false,
  points_status      text NOT NULL DEFAULT 'pending' CHECK (points_status IN ('pending','credited','skipped')),
  points_amount      int NOT NULL DEFAULT 0,
  redeemed_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_redemption_per_user_code UNIQUE (user_id, code_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_redemption_per_user_campaign
  ON public.code_redemptions (user_id, campaign_id) WHERE campaign_id IS NOT NULL;
GRANT SELECT ON public.code_redemptions TO authenticated;
GRANT ALL ON public.code_redemptions TO service_role;
ALTER TABLE public.code_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "code_redemptions_owner_read" ON public.code_redemptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "code_redemptions_admin_read" ON public.code_redemptions
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE TRIGGER update_tracking_campaigns_updated_at
  BEFORE UPDATE ON public.tracking_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.campaign_funnel_stats(p_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner_type text; v_owner_id uuid; v_result jsonb;
BEGIN
  SELECT owner_type, owner_id INTO v_owner_type, v_owner_id
  FROM public.tracking_campaigns WHERE id = p_campaign_id;
  IF v_owner_type IS NULL THEN RETURN NULL; END IF;
  IF NOT (is_admin(auth.uid()) OR is_super_admin(auth.uid())
          OR public.user_owns_tracking_campaign(v_owner_type, v_owner_id)) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  WITH e AS (
    SELECT event_type, visitor_id, user_id
    FROM public.tracking_events
    WHERE campaign_id = p_campaign_id AND COALESCE(ua_family,'') <> 'bot'
  ),
  agg AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type='scan')                            AS scans,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event_type='scan')          AS unique_visitors,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type='signup_completed') AS signups,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type='code_redeemed')    AS redemptions,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type='activated')        AS activations,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type='first_purchase')   AS first_purchases
    FROM e
  )
  SELECT jsonb_build_object(
    'scans', scans, 'unique_visitors', unique_visitors, 'signups', signups,
    'redemptions', redemptions, 'activations', activations, 'first_purchases', first_purchases,
    'cr_scan_to_signup',   ROUND(100.0 * signups / NULLIF(unique_visitors,0), 1),
    'cr_signup_to_active', ROUND(100.0 * activations / NULLIF(signups,0), 1),
    'cr_scan_to_active',   ROUND(100.0 * activations / NULLIF(unique_visitors,0), 1),
    'cr_active_to_buyer',  ROUND(100.0 * first_purchases / NULLIF(activations,0), 1)
  ) INTO v_result FROM agg;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.campaign_funnel_timeseries(p_campaign_id uuid, p_days int DEFAULT 30)
RETURNS TABLE (day date, scans int, signups int, activations int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner_type text; v_owner_id uuid;
BEGIN
  SELECT owner_type, owner_id INTO v_owner_type, v_owner_id
  FROM public.tracking_campaigns WHERE id = p_campaign_id;
  IF v_owner_type IS NULL THEN RETURN; END IF;
  IF NOT (is_admin(auth.uid()) OR is_super_admin(auth.uid())
          OR public.user_owns_tracking_campaign(v_owner_type, v_owner_id)) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  SELECT d::date,
    COUNT(*) FILTER (WHERE te.event_type='scan')::int,
    COUNT(*) FILTER (WHERE te.event_type='signup_completed')::int,
    COUNT(*) FILTER (WHERE te.event_type='activated')::int
  FROM generate_series((now()::date - (p_days-1))::timestamptz, now()::date::timestamptz, interval '1 day') d
  LEFT JOIN public.tracking_events te
    ON te.campaign_id = p_campaign_id
   AND te.created_at::date = d::date
   AND COALESCE(te.ua_family,'') <> 'bot'
  GROUP BY d ORDER BY d;
END; $$;
