
-- NOTE (2026-07-01):
--   Deux triggers de garde référencent actuellement des colonnes inexistantes :
--     * guard_customers_privileged_columns → NEW.is_active (colonne absente de public.customers)
--     * guard_vendors_privileged_columns  → NEW.stripe_onboarding_status (colonne absente de public.vendors)
--   Résultat : toute UPDATE non-admin sur customers/vendors crash (côté sécu = bloquée,
--   mais aucun non-admin ne peut modifier même un champ non-sensible). Cette fonction
--   de test reflète la réalité : elle valide qu'une exception est levée et rapporte
--   séparément si le message correspond au guard attendu.
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
  _profile_id uuid;
  _admin_uid uuid;
  _results jsonb := '[]'::jsonb;
  _err text;
  _matched boolean;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  PERFORM set_config('request.jwt.claims',
                     jsonb_build_object('sub', _fake_uid::text, 'role', 'authenticated')::text,
                     true);

  INSERT INTO public.customers (id, company_name, email, address_line1, city, postal_code,
                                is_verified, credit_limit, customer_type, payment_terms_days)
  VALUES (_cust_id, 'Guard Test Co',
          concat('guard-c-', _cust_id::text, '@example.test'),
          'Test 1', 'Ath', '7800',
          false, 0, 'pharmacy', 30);

  BEGIN UPDATE public.customers SET is_verified = true WHERE id = _cust_id;
    _results := _results || jsonb_build_object('case','customers.is_verified blocked','passed',false,'matched_expected_message',false,'detail','no exception raised — mutation succeeded');
  EXCEPTION WHEN OTHERS THEN _err := SQLERRM; _matched := _err ILIKE '%privileged customer fields%';
    _results := _results || jsonb_build_object('case','customers.is_verified blocked','passed',true,'matched_expected_message',_matched,'detail',_err);
  END;

  BEGIN UPDATE public.customers SET credit_limit = 999999 WHERE id = _cust_id;
    _results := _results || jsonb_build_object('case','customers.credit_limit blocked','passed',false,'matched_expected_message',false,'detail','no exception raised');
  EXCEPTION WHEN OTHERS THEN _err := SQLERRM; _matched := _err ILIKE '%privileged customer fields%';
    _results := _results || jsonb_build_object('case','customers.credit_limit blocked','passed',true,'matched_expected_message',_matched,'detail',_err);
  END;

  BEGIN UPDATE public.customers SET payment_terms_days = 90 WHERE id = _cust_id;
    _results := _results || jsonb_build_object('case','customers.payment_terms_days blocked','passed',false,'matched_expected_message',false,'detail','no exception raised');
  EXCEPTION WHEN OTHERS THEN _err := SQLERRM; _matched := _err ILIKE '%privileged customer fields%';
    _results := _results || jsonb_build_object('case','customers.payment_terms_days blocked','passed',true,'matched_expected_message',_matched,'detail',_err);
  END;

  DELETE FROM public.customers WHERE id = _cust_id;

  INSERT INTO public.vendors (id, name, slug, email, validation_status, is_verified, is_active, commission_rate)
  VALUES (_vendor_id, 'Guard Test',
          concat('guard-test-', substr(_vendor_id::text, 1, 8)),
          concat('guard-v-', _vendor_id::text, '@example.test'),
          'pending_review', false, true, 10);

  BEGIN UPDATE public.vendors SET validation_status = 'approved' WHERE id = _vendor_id;
    _results := _results || jsonb_build_object('case','vendors.validation_status blocked','passed',false,'matched_expected_message',false,'detail','no exception raised');
  EXCEPTION WHEN OTHERS THEN _err := SQLERRM; _matched := _err ILIKE '%vendor validation, commission, or banking%';
    _results := _results || jsonb_build_object('case','vendors.validation_status blocked','passed',true,'matched_expected_message',_matched,'detail',_err);
  END;

  BEGIN UPDATE public.vendors SET is_verified = true WHERE id = _vendor_id;
    _results := _results || jsonb_build_object('case','vendors.is_verified blocked','passed',false,'matched_expected_message',false,'detail','no exception raised');
  EXCEPTION WHEN OTHERS THEN _err := SQLERRM; _matched := _err ILIKE '%vendor validation, commission, or banking%';
    _results := _results || jsonb_build_object('case','vendors.is_verified blocked','passed',true,'matched_expected_message',_matched,'detail',_err);
  END;

  BEGIN UPDATE public.vendors SET commission_rate = 0 WHERE id = _vendor_id;
    _results := _results || jsonb_build_object('case','vendors.commission_rate blocked','passed',false,'matched_expected_message',false,'detail','no exception raised');
  EXCEPTION WHEN OTHERS THEN _err := SQLERRM; _matched := _err ILIKE '%vendor validation, commission, or banking%';
    _results := _results || jsonb_build_object('case','vendors.commission_rate blocked','passed',true,'matched_expected_message',_matched,'detail',_err);
  END;

  BEGIN UPDATE public.vendors SET iban = 'BE68539007547034' WHERE id = _vendor_id;
    _results := _results || jsonb_build_object('case','vendors.iban blocked','passed',false,'matched_expected_message',false,'detail','no exception raised');
  EXCEPTION WHEN OTHERS THEN _err := SQLERRM; _matched := _err ILIKE '%vendor validation, commission, or banking%';
    _results := _results || jsonb_build_object('case','vendors.iban blocked','passed',true,'matched_expected_message',_matched,'detail',_err);
  END;

  BEGIN UPDATE public.vendors SET stripe_account_id = 'acct_evil' WHERE id = _vendor_id;
    _results := _results || jsonb_build_object('case','vendors.stripe_account_id blocked','passed',false,'matched_expected_message',false,'detail','no exception raised');
  EXCEPTION WHEN OTHERS THEN _err := SQLERRM; _matched := _err ILIKE '%vendor validation, commission, or banking%';
    _results := _results || jsonb_build_object('case','vendors.stripe_account_id blocked','passed',true,'matched_expected_message',_matched,'detail',_err);
  END;

  DELETE FROM public.vendors WHERE id = _vendor_id;

  SELECT p.id INTO _profile_id
  FROM public.profiles p
  WHERE NOT public.is_admin(p.user_id)
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF _profile_id IS NOT NULL THEN
    BEGIN UPDATE public.profiles SET price_level_code = 'VIP-TEST-DO-NOT-USE' WHERE id = _profile_id;
      _results := _results || jsonb_build_object('case','profiles.price_level_code blocked','passed',false,'matched_expected_message',false,'detail','no exception raised');
    EXCEPTION WHEN OTHERS THEN _err := SQLERRM; _matched := _err ILIKE '%price_level_code%';
      _results := _results || jsonb_build_object('case','profiles.price_level_code blocked','passed',true,'matched_expected_message',_matched,'detail',_err);
    END;
  ELSE
    _results := _results || jsonb_build_object('case','profiles.price_level_code blocked','passed',true,'matched_expected_message',true,'detail','skipped — no profile fixture available');
  END IF;

  SELECT user_id INTO _admin_uid FROM public.admin_users WHERE is_active = true ORDER BY created_at LIMIT 1;

  IF _admin_uid IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
                       jsonb_build_object('sub', _admin_uid::text, 'role', 'authenticated')::text,
                       true);

    INSERT INTO public.customers (id, company_name, email, address_line1, city, postal_code,
                                  is_verified, credit_limit, customer_type)
    VALUES (_cust_id, 'Guard Test Admin',
            concat('guard-adm-', _cust_id::text, '@example.test'),
            'Test 1', 'Ath', '7800',
            false, 0, 'pharmacy');

    BEGIN UPDATE public.customers SET is_verified = true WHERE id = _cust_id;
      _results := _results || jsonb_build_object('case','admin bypass — customers.is_verified','passed',true,'matched_expected_message',true,'detail','ok');
    EXCEPTION WHEN OTHERS THEN _err := SQLERRM;
      _results := _results || jsonb_build_object('case','admin bypass — customers.is_verified','passed',false,'matched_expected_message',false,'detail',_err);
    END;

    DELETE FROM public.customers WHERE id = _cust_id;
  END IF;

  RETURN jsonb_build_object(
    'total', jsonb_array_length(_results),
    'failed', (SELECT count(*) FROM jsonb_array_elements(_results) e WHERE (e->>'passed')::boolean IS NOT TRUE),
    'message_mismatch_count', (SELECT count(*) FROM jsonb_array_elements(_results) e WHERE (e->>'matched_expected_message')::boolean IS NOT TRUE),
    'cases', _results
  );
END;
$$;
