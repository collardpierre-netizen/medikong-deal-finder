
-- 1. Table principale
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  admin_email text,
  action text NOT NULL,
  target_id uuid,
  target_type text,
  path text,
  ip text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admins insert audit log"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND (admin_id IS NULL OR admin_id = auth.uid()));

CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx ON public.admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON public.admin_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON public.admin_audit_log(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log(created_at DESC);

-- 2. RPC d'insertion sécurisée
CREATE OR REPLACE FUNCTION public.log_admin_audit_event(
  _action text,
  _target_id uuid DEFAULT NULL,
  _target_type text DEFAULT NULL,
  _path text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_email text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _action IS NULL OR length(btrim(_action)) = 0 THEN
    RAISE EXCEPTION 'action_required';
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  INSERT INTO public.admin_audit_log(
    admin_id, admin_email, action, target_id, target_type, path, metadata
  ) VALUES (
    auth.uid(), v_email, _action, _target_id, _target_type, _path, COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_audit_event(text, uuid, text, text, jsonb) TO authenticated;

-- 3. Triggers automatiques sur impersonification
CREATE OR REPLACE FUNCTION public.trg_log_impersonation_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    BEGIN
      SELECT email INTO v_email FROM auth.users WHERE id = NEW.admin_user_id;
    EXCEPTION WHEN OTHERS THEN v_email := NULL; END;
    INSERT INTO public.admin_audit_log(admin_id, admin_email, action, target_id, target_type, metadata)
    VALUES (NEW.admin_user_id, v_email, 'impersonate.start', NEW.target_user_id, 'buyer',
            jsonb_build_object('session_id', NEW.id, 'reason', NEW.reason));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
    BEGIN
      SELECT email INTO v_email FROM auth.users WHERE id = NEW.admin_user_id;
    EXCEPTION WHEN OTHERS THEN v_email := NULL; END;
    INSERT INTO public.admin_audit_log(admin_id, admin_email, action, target_id, target_type, metadata)
    VALUES (NEW.admin_user_id, v_email, 'impersonate.stop', NEW.target_user_id, 'buyer',
            jsonb_build_object('session_id', NEW.id,
              'duration_seconds', EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::int));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_buyer_impersonation ON public.buyer_impersonation_sessions;
CREATE TRIGGER trg_log_buyer_impersonation
  AFTER INSERT OR UPDATE ON public.buyer_impersonation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_impersonation_event();

-- 4. Mirror automatique des changements profil pro
CREATE OR REPLACE FUNCTION public.trg_log_profile_change_to_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.changed_by;
  EXCEPTION WHEN OTHERS THEN v_email := NULL; END;
  INSERT INTO public.admin_audit_log(admin_id, admin_email, action, target_id, target_type, metadata)
  VALUES (NEW.changed_by, v_email,
          'customer.profile_change.' || NEW.field_name,
          NEW.customer_id, 'customer',
          jsonb_build_object(
            'old_value', NEW.old_value, 'new_value', NEW.new_value,
            'old_label', NEW.old_label, 'new_label', NEW.new_label,
            'reason', NEW.reason));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_profile_history_to_audit ON public.customer_profile_history;
CREATE TRIGGER trg_mirror_profile_history_to_audit
  AFTER INSERT ON public.customer_profile_history
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_profile_change_to_audit();

-- 5. Purge auto >12 mois
CREATE OR REPLACE FUNCTION public.purge_admin_audit_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  DELETE FROM public.admin_audit_log WHERE created_at < now() - INTERVAL '12 months';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_admin_audit_log() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_admin_audit_log() TO service_role;

-- 6. Cron quotidien
SELECT cron.unschedule('purge-admin-audit-log-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-admin-audit-log-daily');

SELECT cron.schedule(
  'purge-admin-audit-log-daily',
  '45 3 * * *',
  $$SELECT public.purge_admin_audit_log();$$
);
