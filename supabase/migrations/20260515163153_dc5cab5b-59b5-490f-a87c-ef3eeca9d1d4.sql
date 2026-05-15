-- Table de log des sessions d'impersonation acheteur
CREATE TABLE public.buyer_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  target_customer_id uuid,
  target_email text,
  target_company_name text,
  reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_reason text
);

CREATE INDEX idx_buyer_impersonation_admin ON public.buyer_impersonation_sessions(admin_user_id, started_at DESC);
CREATE INDEX idx_buyer_impersonation_target ON public.buyer_impersonation_sessions(target_user_id, started_at DESC);

ALTER TABLE public.buyer_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Lecture : super-admins uniquement
CREATE POLICY "super_admin_read_buyer_impersonation"
  ON public.buyer_impersonation_sessions FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Pas d'INSERT/UPDATE/DELETE direct : tout passe par les RPC SECURITY DEFINER

-- RPC : ouvre une session
CREATE OR REPLACE FUNCTION public.start_buyer_impersonation(
  _target_user_id uuid,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_session_id uuid;
  v_customer_id uuid;
  v_email text;
  v_company text;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_super_admin(v_admin) THEN
    RAISE EXCEPTION 'Only super_admin can impersonate users';
  END IF;
  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id required';
  END IF;
  IF _target_user_id = v_admin THEN
    RAISE EXCEPTION 'Cannot impersonate yourself';
  END IF;

  SELECT c.id, c.email, c.company_name
    INTO v_customer_id, v_email, v_company
  FROM public.customers c
  WHERE c.auth_user_id = _target_user_id
  LIMIT 1;

  INSERT INTO public.buyer_impersonation_sessions(
    admin_user_id, target_user_id, target_customer_id,
    target_email, target_company_name, reason
  ) VALUES (
    v_admin, _target_user_id, v_customer_id, v_email, v_company, _reason
  ) RETURNING id INTO v_session_id;

  BEGIN
    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_admin,
      'buyer_impersonation_started',
      'buyer_impersonation_session',
      v_session_id,
      jsonb_build_object(
        'target_user_id', _target_user_id,
        'target_customer_id', v_customer_id,
        'target_email', v_email,
        'reason', _reason
      )
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  RETURN v_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_buyer_impersonation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_buyer_impersonation(uuid, text) TO authenticated;

-- RPC : ferme une session (super_admin = celui qui a ouvert OU n'importe quel super_admin)
CREATE OR REPLACE FUNCTION public.end_buyer_impersonation(
  _session_id uuid,
  _ended_reason text DEFAULT 'manual'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row record;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_super_admin(v_admin) THEN
    RAISE EXCEPTION 'Only super_admin can end impersonation sessions';
  END IF;

  SELECT * INTO v_row FROM public.buyer_impersonation_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_row.ended_at IS NOT NULL THEN RETURN; END IF;

  UPDATE public.buyer_impersonation_sessions
     SET ended_at = now(),
         ended_reason = COALESCE(_ended_reason, 'manual')
   WHERE id = _session_id;

  BEGIN
    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_admin,
      'buyer_impersonation_ended',
      'buyer_impersonation_session',
      _session_id,
      jsonb_build_object(
        'target_user_id', v_row.target_user_id,
        'ended_reason', COALESCE(_ended_reason, 'manual')
      )
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.end_buyer_impersonation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_buyer_impersonation(uuid, text) TO authenticated;