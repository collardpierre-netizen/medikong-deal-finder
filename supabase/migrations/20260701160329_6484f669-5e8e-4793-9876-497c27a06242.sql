
CREATE OR REPLACE FUNCTION public.admin_test_privileged_column_guards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fake_uid uuid := gen_random_uuid();
  _cust_id uuid := gen_random_uuid();
  _vendor_id uuid := gen_random_uuid();
  _profile_id uuid := gen_random_uuid();
  _admin_uid uuid;
  _results jsonb := '[]'::jsonb;
  _err text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  PERFORM set_config('request.jwt.claims',
                     jsonb_build_object('sub', _fake_uid::text, 'role', 'authenticated')::text,
                     true);

  INSERT INTO public.customers (id, company_name, is_verified, credit_limit, customer_type, payment_terms_days)
  VALUES (_cust_id, 'Guard Test Co', false, 0, 'pharmacy', 30);

  BEGIN
    UPDATE public.customers SET is_verified = true WHERE id = _cust_id;
    _results := _results || jsonb_build_object('case','customers.is_verified blocked','passed',false,'detail','no exception');
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    _results := _results || jsonb_build_object('case','customers.is_verified blocked','passed', _err ILIKE '%privileged customer fields%','detail', _err);
  END;

  BEGIN
    UPDATE public.customers SET credit_limit = 999999 WHERE id = _cust_id;
    _results := _results || jsonb_build_object('case','customers.credit_limit blocked','passed',false,'detail','no exception');
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    _results := _results || jsonb_build_object('case','customers.credit_limit blocked','passed', _err ILIKE '%privileged customer fields%','detail', _err);
  END;

  BEGIN
    UPDATE public.customers SET payment_terms_days = 90 WHERE id = _cust_id;
    _results := _results || jsonb_build_object('case','customers.payment_terms_days blocked','passed',false,'detail','no exception');
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    _results := _results || jsonb_build_object('case','customers.payment_terms_days blocked','passed', _err ILIKE '%privileged customer fields%','detail', _err);
  END;

  BEGIN
    UPDATE public.customers SET updated_at = now() WHERE id = _cust_id;
    _results := _results || jsonb_build_object('case','customers non-privileged update allowed','passed',true,'detail','ok');
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    _results := _results || jsonb_build_object('case','customers non-privileged update allowed','passed',false,'detail', _err);
  END;

  DELETE FROM public.customers WHERE id = _cust_id;

  INSERT INTO public.vendors (id, name, email, validation_status, is_verified, is_active, commission_rate)
  VALUES (_vendor_id, 'Guard Test', concat('guard-', _vendor_id::text, '@example.test'),
          'pending', false, true, 10);

  BEGIN
    UPDATE public.vendors SET validation_status = 'approved' WHERE id = _vendor_id;
    _results := _results || jsonb_build_object('case','vendors.validation_status blocked','passed',false,'detail','no exception');
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    _results := _results || jsonb_build_object('case','vendors.validation_status blocked','passed', _err ILIKE '%vendor validation, commission, or banking%','detail', _err);
  END;

  BEGIN
    UPDATE public.vendors SET is_verified = true WHERE id = _vendor_id;
    _results := _results || jsonb_build_object('case','vendors.is_verified blocked','passed',false,'detail','no exception');
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    _results := _results || jsonb_build_object('case','vendors.is_verified blocked','passed', _err ILIKE '%vendor validation, commission, or banking%','detail', _err);
  END;

  BEGIN
    UPDATE public.vendors SET commission_rate = 0 WHERE id = _vendor_id;
    _results := _results || jsonb_build_object('case','vendors.commission_rate blocked','passed',false,'detail','no exception');
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    _results := _results || jsonb_build_object('case','vendors.commission_rate blocked','passed', _err ILIKE '%vendor validation, commission, or banking%','detail', _err);
  END;

  BEGIN
    UPDATE public.vendors SET iban = 'BE68539007547034' WHERE id = _vendor_id;
    _results := _results || jsonb_build_object('case','vendors.iban blocked','passed',false,'detail','no exception');
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    _results := _results || jsonb_build_object('case','vendors.iban blocked','passed', _err ILIKE '%vendor validation, commission, or banking%','detail', _err);
  END;

  BEGIN
    UPDATE public.vendors SET stripe_account_id = 'acct_evil' WHERE id = _vendor_id;
    _results := _results || jsonb_build_object('case','vendors.stripe_account_id blocked','passed',false,'detail','no exception');
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    _results := _results || jsonb_build_object('case','vendors.stripe_account_id blocked','passed', _err ILIKE '%vendor validation, commission, or banking%','detail', _err);
  END;

  BEGIN
    UPDATE public.vendors SET description = 'ok' WHERE id = _vendor_id;
    _results := _results || jsonb_build_object('case','vendors non-privileged update allowed','passed',true,'detail','ok');
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    _results := _results || jsonb_build_object('case','vendors non-privileged update allowed','passed',false,'detail', _err);
  END;

  DELETE FROM public.vendors WHERE id = _vendor_id;

  INSERT INTO public.profiles (id, full_name) VALUES (_profile_id, 'Guard Test');

  BEGIN
    UPDATE public.profiles SET price_level_code = 'VIP' WHERE id = _profile_id;
    _results := _results || jsonb_build_object('case','profiles.price_level_code blocked','passed',false,'detail','no exception');
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    _results := _results || jsonb_build_object('case','profiles.price_level_code blocked','passed', _err ILIKE '%price_level_code%','detail', _err);
  END;

  BEGIN
    UPDATE public.profiles SET full_name = 'Renamed' WHERE id = _profile_id;
    _results := _results || jsonb_build_object('case','profiles non-privileged update allowed','passed',true,'detail','ok');
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    _results := _results || jsonb_build_object('case','profiles non-privileged update allowed','passed',false,'detail', _err);
  END;

  DELETE FROM public.profiles WHERE id = _profile_id;

  SELECT user_id INTO _admin_uid FROM public.admin_users WHERE is_active = true ORDER BY created_at LIMIT 1;

  IF _admin_uid IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
                       jsonb_build_object('sub', _admin_uid::text, 'role', 'authenticated')::text,
                       true);

    INSERT INTO public.customers (id, company_name, is_verified, credit_limit, customer_type)
    VALUES (_cust_id, 'Guard Test Admin', false, 0, 'pharmacy');

    BEGIN
      UPDATE public.customers SET is_verified = true WHERE id = _cust_id;
      _results := _results || jsonb_build_object('case','admin bypass — customers.is_verified','passed',true,'detail','ok');
    EXCEPTION WHEN OTHERS THEN
      _err := SQLERRM;
      _results := _results || jsonb_build_object('case','admin bypass — customers.is_verified','passed',false,'detail', _err);
    END;

    DELETE FROM public.customers WHERE id = _cust_id;
  END IF;

  RETURN jsonb_build_object(
    'total', jsonb_array_length(_results),
    'failed', (SELECT count(*) FROM jsonb_array_elements(_results) e WHERE (e->>'passed')::boolean IS NOT TRUE),
    'cases', _results
  );
END;
$$;
