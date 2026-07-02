
CREATE OR REPLACE FUNCTION public.current_active_account_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_headers json;
  v_raw text;
  v_kind text;
  v_id uuid;
  v_uid uuid;
  v_ok boolean;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF v_headers IS NULL THEN RETURN NULL; END IF;

  v_raw := v_headers ->> 'x-active-account-id';
  IF v_raw IS NULL OR v_raw = '' THEN RETURN NULL; END IF;
  BEGIN v_id := v_raw::uuid; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;

  v_kind := v_headers ->> 'x-active-account-kind';
  IF v_kind IS NULL OR v_kind NOT IN ('buyer','vendor','admin') THEN RETURN NULL; END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  IF v_kind = 'buyer' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.account_memberships m
      WHERE m.user_id = v_uid AND m.account_kind = 'buyer' AND m.account_id = v_id
    ) OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = v_id AND p.id = v_uid
    ) INTO v_ok;
  ELSIF v_kind = 'vendor' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.account_memberships m
      WHERE m.user_id = v_uid AND m.account_kind = 'vendor' AND m.account_id = v_id
    ) OR EXISTS (
      SELECT 1 FROM public.vendors v WHERE v.id = v_id AND v.auth_user_id = v_uid
    ) INTO v_ok;
  ELSIF v_kind = 'admin' THEN
    SELECT public.is_admin(v_uid) INTO v_ok;
  ELSE
    v_ok := false;
  END IF;

  IF v_ok THEN RETURN v_id; ELSE RETURN NULL; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.current_active_account_kind()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_headers json;
  v_raw text;
BEGIN
  -- Only return a kind if the id was validated
  v_id := public.current_active_account_id();
  IF v_id IS NULL THEN RETURN NULL; END IF;
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF v_headers IS NULL THEN RETURN NULL; END IF;
  v_raw := v_headers ->> 'x-active-account-kind';
  IF v_raw NOT IN ('buyer','vendor','admin') THEN RETURN NULL; END IF;
  RETURN v_raw;
END; $$;
