
-- ============================================================================
-- 1. TABLE security_audit_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('rfq_admin','storage','ddl','auth_role','other')),
  action text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  actor_id uuid,
  actor_email text,
  actor_role text,
  target_type text,
  target_id text,
  payload jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.security_audit_logs TO authenticated;
GRANT ALL ON public.security_audit_logs TO service_role;

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read security audit logs"
  ON public.security_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "System inserts security audit logs"
  ON public.security_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_security_audit_created ON public.security_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_category_created ON public.security_audit_logs (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_severity_created ON public.security_audit_logs (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_actor ON public.security_audit_logs (actor_id, created_at DESC);

-- ============================================================================
-- 2. Helper SQL log_security_event
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_security_event(
  _category text,
  _action text,
  _severity text DEFAULT 'info',
  _target_type text DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _email text;
  _role text;
BEGIN
  BEGIN
    SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN _email := NULL;
  END;

  BEGIN
    SELECT role::text INTO _role
    FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN _role := NULL;
  END;

  INSERT INTO public.security_audit_logs
    (category, action, severity, actor_id, actor_email, actor_role,
     target_type, target_id, payload)
  VALUES
    (_category, _action, COALESCE(_severity,'info'), auth.uid(), _email, _role,
     _target_type, _target_id, COALESCE(_payload,'{}'::jsonb))
  RETURNING id INTO _id;

  RETURN _id;
EXCEPTION WHEN OTHERS THEN
  -- Ne JAMAIS bloquer l'opération métier à cause d'un échec de log
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_event(text,text,text,text,text,jsonb) TO authenticated, service_role;

-- ============================================================================
-- 3. Wrap rfq_admin_add_vendor : journalisation append-only
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rfq_admin_add_vendor(
  _rfq_id uuid,
  _vendor_id uuid,
  _bypass_eligibility boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _reason public.rfq_target_reason;
  _notif_id uuid;
  _was_new boolean;
  _rfq record;
  _bypassed boolean := false;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id, product_id, brand_id, quantity, destination_country_code, responses_deadline
  INTO _rfq FROM public.rfqs WHERE id = _rfq_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RFQ % not found', _rfq_id;
  END IF;

  SELECT reason INTO _reason
  FROM public.rfq_score_target_vendors(_rfq_id)
  WHERE vendor_id = _vendor_id
  LIMIT 1;

  IF _reason IS NULL THEN
    IF NOT _bypass_eligibility THEN
      RAISE EXCEPTION 'Vendor % does not pass eligibility filters for RFQ %', _vendor_id, _rfq_id
        USING ERRCODE = '22023';
    END IF;
    _reason := 'manual'::public.rfq_target_reason;
    _bypassed := true;
  END IF;

  INSERT INTO public.rfq_dispatch_log (rfq_id, vendor_id, reason, status)
  VALUES (_rfq_id, _vendor_id, _reason, 'dispatched')
  ON CONFLICT (rfq_id, vendor_id) DO NOTHING
  RETURNING true INTO _was_new;

  _was_new := COALESCE(_was_new, false);

  IF _was_new THEN
    INSERT INTO public.vendor_notifications (vendor_id, type, title, body, cta_url, payload)
    VALUES (_vendor_id, 'rfq_received', 'Nouvelle demande de prix',
            'Un acheteur sollicite un devis. Connectez-vous à votre portail vendeur pour répondre avant expiration.',
            '/vendor/rfq/' || _rfq_id::text,
            jsonb_build_object(
              'rfq_id', _rfq_id, 'reason', _reason::text,
              'product_id', _rfq.product_id, 'brand_id', _rfq.brand_id,
              'quantity', _rfq.quantity, 'country', _rfq.destination_country_code,
              'deadline', _rfq.responses_deadline,
              'added_by_admin', true,
              'bypassed_eligibility', _bypassed))
    RETURNING id INTO _notif_id;

    UPDATE public.rfq_dispatch_log
      SET notification_id = _notif_id
      WHERE rfq_id = _rfq_id AND vendor_id = _vendor_id;

    INSERT INTO public.rfq_routing_audit_log
      (rfq_id, vendor_id, decision, reason_code, reason_label, matched_reason, details)
    VALUES (_rfq_id, _vendor_id, 'selected',
            CASE WHEN _bypassed THEN 'manual_admin_bypass' ELSE 'manual_admin' END,
            CASE WHEN _bypassed
                 THEN 'Forcé par un administrateur (bypass éligibilité)'
                 ELSE 'Ajouté manuellement par un administrateur' END,
            _reason,
            jsonb_build_object('admin_user_id', auth.uid(), 'bypassed', _bypassed))
    ON CONFLICT (rfq_id, vendor_id) DO UPDATE SET
      decision = 'selected',
      reason_code = EXCLUDED.reason_code,
      reason_label = EXCLUDED.reason_label,
      matched_reason = EXCLUDED.matched_reason,
      details = EXCLUDED.details,
      created_at = now();
  END IF;

  -- AUDIT SÉCURITÉ
  PERFORM public.log_security_event(
    'rfq_admin',
    CASE WHEN _bypassed THEN 'rfq_admin_add_vendor.bypass' ELSE 'rfq_admin_add_vendor' END,
    CASE WHEN _bypassed THEN 'critical' ELSE 'warning' END,
    'rfq', _rfq_id::text,
    jsonb_build_object(
      'vendor_id', _vendor_id,
      'bypass_eligibility', _bypass_eligibility,
      'bypassed', _bypassed,
      'was_new_target', _was_new,
      'reason', _reason::text
    )
  );

  RETURN jsonb_build_object(
    'rfq_id', _rfq_id,
    'vendor_id', _vendor_id,
    'reason', _reason,
    'was_new', _was_new,
    'bypassed_eligibility', _bypassed
  );
END;
$function$;

-- ============================================================================
-- 4. Wrap rfq_admin_invite_external_vendor : journalisation append-only
-- ============================================================================
DO $$
DECLARE _src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO _src
  FROM pg_proc
  WHERE proname='rfq_admin_invite_external_vendor' AND pronamespace='public'::regnamespace
  LIMIT 1;
  IF _src IS NULL THEN
    RAISE NOTICE 'rfq_admin_invite_external_vendor not found, skipping wrap';
  END IF;
END $$;

-- Patch léger : trigger AFTER INSERT sur rfq_external_invitations (créées par la RPC)
CREATE OR REPLACE FUNCTION public._audit_rfq_external_invitation_ai()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_security_event(
    'rfq_admin',
    'rfq_admin_invite_external_vendor',
    'warning',
    'rfq', NEW.rfq_id::text,
    jsonb_build_object(
      'external_vendor_id', NEW.external_vendor_id,
      'contact_email', NEW.contact_email,
      'invitation_id', NEW.id,
      'expires_at', NEW.expires_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_rfq_external_invitation ON public.rfq_external_invitations;
CREATE TRIGGER trg_audit_rfq_external_invitation
AFTER INSERT ON public.rfq_external_invitations
FOR EACH ROW EXECUTE FUNCTION public._audit_rfq_external_invitation_ai();

-- ============================================================================
-- 5. Trigger admin_users : journalise role/account changes
-- ============================================================================
CREATE OR REPLACE FUNCTION public._audit_admin_users_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_security_event(
      'auth_role',
      'admin_user.created',
      'critical',
      'admin_user', NEW.id::text,
      jsonb_build_object(
        'target_user_id', NEW.user_id,
        'target_email', NEW.email,
        'role', NEW.role::text,
        'is_active', NEW.is_active
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.role IS DISTINCT FROM NEW.role)
       OR (OLD.is_active IS DISTINCT FROM NEW.is_active)
       OR (OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
      PERFORM public.log_security_event(
        'auth_role',
        'admin_user.updated',
        'critical',
        'admin_user', NEW.id::text,
        jsonb_build_object(
          'target_user_id', NEW.user_id,
          'target_email', NEW.email,
          'old_role', OLD.role::text,
          'new_role', NEW.role::text,
          'old_active', OLD.is_active,
          'new_active', NEW.is_active
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_security_event(
      'auth_role',
      'admin_user.deleted',
      'critical',
      'admin_user', OLD.id::text,
      jsonb_build_object(
        'target_user_id', OLD.user_id,
        'target_email', OLD.email,
        'role', OLD.role::text
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_admin_users ON public.admin_users;
CREATE TRIGGER trg_audit_admin_users
AFTER INSERT OR UPDATE OR DELETE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public._audit_admin_users_change();

-- ============================================================================
-- 6. Event trigger DDL : journalise DROP/ALTER POLICY, GRANT/REVOKE, DROP TABLE
-- ============================================================================
CREATE OR REPLACE FUNCTION public._audit_ddl_event()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  _sev text;
BEGIN
  FOR r IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF r.command_tag NOT IN (
      'DROP TABLE','DROP POLICY','ALTER POLICY','CREATE POLICY',
      'GRANT','REVOKE','ALTER TABLE','DROP FUNCTION'
    ) THEN
      CONTINUE;
    END IF;

    -- Filtre : on ne logge que les objets dans public ou storage
    IF r.schema_name IS NULL
       OR r.schema_name NOT IN ('public','storage') THEN
      CONTINUE;
    END IF;

    _sev := CASE
      WHEN r.command_tag IN ('DROP TABLE','DROP POLICY','REVOKE') THEN 'critical'
      WHEN r.command_tag IN ('ALTER POLICY','CREATE POLICY','GRANT') THEN 'warning'
      ELSE 'info'
    END;

    BEGIN
      INSERT INTO public.security_audit_logs
        (category, action, severity, actor_id, target_type, target_id, payload)
      VALUES
        ('ddl',
         'ddl.' || lower(replace(r.command_tag,' ','_')),
         _sev,
         NULL, -- DDL hors session utilisateur (souvent migrations)
         r.object_type,
         r.object_identity,
         jsonb_build_object(
           'command_tag', r.command_tag,
           'schema', r.schema_name,
           'object_type', r.object_type,
           'object_identity', r.object_identity,
           'in_extension', r.in_extension
         ));
    EXCEPTION WHEN OTHERS THEN NULL; -- never block DDL
    END;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS trg_audit_ddl;
CREATE EVENT TRIGGER trg_audit_ddl
ON ddl_command_end
EXECUTE FUNCTION public._audit_ddl_event();

-- ============================================================================
-- 7. RPC admin lecture paginée
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_security_audit_query(
  _category text DEFAULT NULL,
  _severity text DEFAULT NULL,
  _actor_id uuid DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to   timestamptz DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit int DEFAULT 100,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, category text, action text, severity text,
  actor_id uuid, actor_email text, actor_role text,
  target_type text, target_id text, payload jsonb,
  created_at timestamptz, total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT s.*
    FROM public.security_audit_logs s
    WHERE (_category IS NULL OR s.category = _category)
      AND (_severity IS NULL OR s.severity = _severity)
      AND (_actor_id IS NULL OR s.actor_id = _actor_id)
      AND (_from IS NULL OR s.created_at >= _from)
      AND (_to   IS NULL OR s.created_at <= _to)
      AND (_search IS NULL OR _search = ''
           OR s.action ILIKE '%'||_search||'%'
           OR s.actor_email ILIKE '%'||_search||'%'
           OR s.target_id ILIKE '%'||_search||'%'
           OR s.payload::text ILIKE '%'||_search||'%')
  ),
  counted AS ( SELECT count(*)::bigint AS c FROM filtered )
  SELECT f.id, f.category, f.action, f.severity,
         f.actor_id, f.actor_email, f.actor_role,
         f.target_type, f.target_id, f.payload,
         f.created_at,
         (SELECT c FROM counted)
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500))
  OFFSET GREATEST(0, _offset);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_security_audit_query(text,text,uuid,timestamptz,timestamptz,text,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_security_audit_query(text,text,uuid,timestamptz,timestamptz,text,int,int) TO authenticated;

-- ============================================================================
-- 8. RPC stats KPIs admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_security_audit_kpis(
  _from timestamptz DEFAULT (now() - interval '30 days')
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _out jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'total', count(*),
    'critical', count(*) FILTER (WHERE severity='critical'),
    'warning',  count(*) FILTER (WHERE severity='warning'),
    'by_category', (
      SELECT jsonb_object_agg(category, c)
      FROM (
        SELECT category, count(*) c
        FROM public.security_audit_logs
        WHERE created_at >= _from
        GROUP BY category
      ) z
    )
  ) INTO _out
  FROM public.security_audit_logs
  WHERE created_at >= _from;

  RETURN COALESCE(_out, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_security_audit_kpis(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_security_audit_kpis(timestamptz) TO authenticated;

-- ============================================================================
-- 9. Purge automatique 90j (critical conservés 2 ans)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.purge_security_audit_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_std int := 0;
  _deleted_crit int := 0;
BEGIN
  DELETE FROM public.security_audit_logs
   WHERE severity <> 'critical'
     AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS _deleted_std = ROW_COUNT;

  DELETE FROM public.security_audit_logs
   WHERE severity = 'critical'
     AND created_at < now() - interval '730 days';
  GET DIAGNOSTICS _deleted_crit = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_standard', _deleted_std,
    'deleted_critical', _deleted_crit,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_security_audit_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_security_audit_logs() TO service_role;

-- Cron quotidien (03:30 UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('purge-security-audit-logs');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-security-audit-logs',
  '30 3 * * *',
  $cron$ SELECT public.purge_security_audit_logs(); $cron$
);
