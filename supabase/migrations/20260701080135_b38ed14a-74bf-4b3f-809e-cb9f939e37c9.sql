
CREATE OR REPLACE FUNCTION public.current_active_account_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_raw text;
BEGIN
  BEGIN v_raw := current_setting('request.active_account_id', true);
  EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
  IF v_raw IS NULL OR v_raw = '' THEN RETURN NULL; END IF;
  BEGIN RETURN v_raw::uuid; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
END; $$;
GRANT EXECUTE ON FUNCTION public.current_active_account_id() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_active_account_kind()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_raw text;
BEGIN
  BEGIN v_raw := current_setting('request.active_account_kind', true);
  EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
  IF v_raw IS NULL OR v_raw = '' THEN RETURN NULL; END IF;
  IF v_raw NOT IN ('buyer','vendor','admin') THEN RETURN NULL; END IF;
  RETURN v_raw;
END; $$;
GRANT EXECUTE ON FUNCTION public.current_active_account_kind() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_active_account(_kind text, _account_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ok boolean := false;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _kind NOT IN ('buyer','vendor','admin') THEN RAISE EXCEPTION 'invalid_kind: %', _kind; END IF;

  IF _kind = 'admin' THEN
    SELECT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id = v_user_id AND is_active = true) INTO v_ok;
  ELSIF _kind = 'buyer' THEN
    SELECT EXISTS(SELECT 1 FROM public.customers WHERE id = _account_id AND auth_user_id = v_user_id)
        OR EXISTS(SELECT 1 FROM public.account_memberships WHERE user_id = v_user_id AND account_kind='buyer' AND account_id=_account_id AND status='active')
      INTO v_ok;
  ELSIF _kind = 'vendor' THEN
    SELECT EXISTS(SELECT 1 FROM public.vendors WHERE id = _account_id AND auth_user_id = v_user_id)
        OR EXISTS(SELECT 1 FROM public.account_memberships WHERE user_id = v_user_id AND account_kind='vendor' AND account_id=_account_id AND status='active')
      INTO v_ok;
  END IF;

  IF NOT v_ok THEN RAISE EXCEPTION 'not_a_member_of_account'; END IF;

  UPDATE public.profiles
     SET preferences = COALESCE(preferences, '{}'::jsonb)
                       || jsonb_build_object('active_account', jsonb_build_object('kind', _kind, 'id', _account_id)),
         updated_at = now()
   WHERE id = v_user_id;

  RETURN jsonb_build_object('kind', _kind, 'account_id', _account_id, 'ok', true);
END; $$;
REVOKE ALL ON FUNCTION public.set_active_account(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.set_active_account(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_accounts()
RETURNS TABLE(kind text, account_id uuid, role text, display_name text, status text, is_owner boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT 'admin'::text, au.id, au.role::text,
         COALESCE(p.full_name, p.email, 'Administrateur')::text,
         'active'::text, true
    FROM public.admin_users au
    LEFT JOIN public.profiles p ON p.id = au.user_id
   WHERE au.user_id = v_user_id AND au.is_active = true;

  RETURN QUERY
  SELECT 'buyer'::text, c.id, 'owner'::text,
         COALESCE(c.company_name, c.email)::text,
         CASE WHEN c.is_verified THEN 'active' ELSE 'pending' END,
         true
    FROM public.customers c
   WHERE c.auth_user_id = v_user_id;

  RETURN QUERY
  SELECT 'buyer'::text, c.id, am.role::text,
         COALESCE(c.company_name, c.email)::text,
         am.status::text, false
    FROM public.account_memberships am
    JOIN public.customers c ON c.id = am.account_id
   WHERE am.user_id = v_user_id
     AND am.account_kind = 'buyer'
     AND am.status = 'active'
     AND (c.auth_user_id IS DISTINCT FROM v_user_id);

  RETURN QUERY
  SELECT 'vendor'::text, v.id, 'owner'::text,
         COALESCE(v.company_name, v.name)::text,
         COALESCE(v.validation_status, 'pending')::text, true
    FROM public.vendors v
   WHERE v.auth_user_id = v_user_id;

  RETURN QUERY
  SELECT 'vendor'::text, v.id, am.role::text,
         COALESCE(v.company_name, v.name)::text,
         am.status::text, false
    FROM public.account_memberships am
    JOIN public.vendors v ON v.id = am.account_id
   WHERE am.user_id = v_user_id
     AND am.account_kind = 'vendor'
     AND am.status = 'active'
     AND (v.auth_user_id IS DISTINCT FROM v_user_id);
END; $$;
REVOKE ALL ON FUNCTION public.get_my_accounts() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.link_customer_to_current_user(_customer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_owner uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT auth_user_id INTO v_existing_owner FROM public.customers WHERE id = _customer_id;
  IF v_existing_owner IS NULL THEN
    UPDATE public.customers SET auth_user_id = v_user_id, updated_at = now() WHERE id = _customer_id;
    INSERT INTO public.account_memberships (user_id, account_kind, account_id, role, status, accepted_at)
    VALUES (v_user_id, 'buyer', _customer_id, 'admin', 'active', now())
    ON CONFLICT DO NOTHING;
  ELSIF v_existing_owner <> v_user_id THEN
    INSERT INTO public.account_memberships (user_id, account_kind, account_id, role, status, accepted_at)
    VALUES (v_user_id, 'buyer', _customer_id, 'member', 'active', now())
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true, 'customer_id', _customer_id);
END; $$;
REVOKE ALL ON FUNCTION public.link_customer_to_current_user(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.link_customer_to_current_user(uuid) TO authenticated;

-- Backfill owners as 'admin' role (matches constraint)
INSERT INTO public.account_memberships (user_id, account_kind, account_id, role, status, accepted_at)
SELECT c.auth_user_id, 'buyer', c.id, 'admin', 'active', now()
  FROM public.customers c
 WHERE c.auth_user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.account_memberships am
                    WHERE am.user_id = c.auth_user_id AND am.account_kind='buyer' AND am.account_id = c.id)
ON CONFLICT DO NOTHING;

INSERT INTO public.account_memberships (user_id, account_kind, account_id, role, status, accepted_at)
SELECT v.auth_user_id, 'vendor', v.id, 'admin', 'active', now()
  FROM public.vendors v
 WHERE v.auth_user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.account_memberships am
                    WHERE am.user_id = v.auth_user_id AND am.account_kind='vendor' AND am.account_id = v.id)
ON CONFLICT DO NOTHING;
