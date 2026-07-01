
CREATE OR REPLACE FUNCTION public.current_active_account_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_headers json;
  v_raw text;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF v_headers IS NULL THEN RETURN NULL; END IF;
  v_raw := v_headers ->> 'x-active-account-id';
  IF v_raw IS NULL OR v_raw = '' THEN RETURN NULL; END IF;
  BEGIN RETURN v_raw::uuid; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
END; $$;

CREATE OR REPLACE FUNCTION public.current_active_account_kind()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_headers json;
  v_raw text;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF v_headers IS NULL THEN RETURN NULL; END IF;
  v_raw := v_headers ->> 'x-active-account-kind';
  IF v_raw IS NULL OR v_raw = '' THEN RETURN NULL; END IF;
  IF v_raw NOT IN ('buyer','vendor','admin') THEN RETURN NULL; END IF;
  RETURN v_raw;
END; $$;
