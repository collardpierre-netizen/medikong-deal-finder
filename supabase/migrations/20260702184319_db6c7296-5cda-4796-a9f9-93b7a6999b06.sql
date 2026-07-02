
CREATE OR REPLACE FUNCTION public.vendor_gmv_filters_self_test()
RETURNS TABLE(scenario text, expected bigint, actual bigint, ok boolean, details text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _marker text := 'GMVTEST_' || replace(gen_random_uuid()::text, '-', '');
  _vendor uuid;
  _owner_uid uuid := gen_random_uuid();
  _customer uuid;
  _rule uuid;
  _year_start timestamptz := date_trunc('year', now());
  _year_end   timestamptz := date_trunc('year', now()) + interval '1 year';
  _prior_year timestamptz := date_trunc('year', now()) - interval '1 day';
  _o_valid uuid; _o_cancelled uuid; _o_forecast uuid; _o_test uuid;
  _o_hidden uuid; _o_deleted uuid; _o_prior uuid;
  _hook_cents bigint; _rpc_cents bigint;
  _progress jsonb;
  _expected_cents bigint := 50000;
  _prev_claims text;
BEGIN
  INSERT INTO public.vendors (id, name, slug, company_name, is_active, country_code, auth_user_id)
  VALUES (gen_random_uuid(), _marker || '_V', lower(_marker) || '-v', _marker || ' SRL', true, 'BE', _owner_uid)
  RETURNING id INTO _vendor;

  INSERT INTO public.customers (id, customer_type, company_name, email, address_line1, city, postal_code, country_code)
  VALUES (gen_random_uuid(), 'pharmacy', _marker || ' Pharma', lower(_marker) || '@test.local',
          '1 rue test', 'Bruxelles', '1000', 'BE')
  RETURNING id INTO _customer;

  INSERT INTO public.margin_rules (id, name, priority, vendor_id, margin_percentage, is_active, gmv_window)
  VALUES (gen_random_uuid(), _marker || '_rule', 999, _vendor, 20.00, true, 'calendar_year')
  RETURNING id INTO _rule;

  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal_excl_vat, total_incl_vat,
                             is_test, is_forecast, hidden_from_list, deleted_at, created_at)
  VALUES (gen_random_uuid(), _marker || '_ok', _customer, 'delivered', 500.00, 605.00,
          false, false, false, NULL, _year_start + interval '10 days')
  RETURNING id INTO _o_valid;
  INSERT INTO public.order_lines (order_id, vendor_id, quantity, unit_price_excl_vat, unit_price_incl_vat, vat_rate, line_total_excl_vat, line_total_incl_vat)
  VALUES (_o_valid, _vendor, 1, 500, 605, 21, 500, 605);

  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal_excl_vat, total_incl_vat, created_at)
  VALUES (gen_random_uuid(), _marker || '_can', _customer, 'cancelled', 100, 121, _year_start + interval '11 days')
  RETURNING id INTO _o_cancelled;
  INSERT INTO public.order_lines (order_id, vendor_id, quantity, unit_price_excl_vat, unit_price_incl_vat, vat_rate, line_total_excl_vat, line_total_incl_vat)
  VALUES (_o_cancelled, _vendor, 1, 100, 121, 21, 100, 121);

  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal_excl_vat, total_incl_vat, is_forecast, created_at)
  VALUES (gen_random_uuid(), _marker || '_fc', _customer, 'confirmed', 200, 242, true, _year_start + interval '12 days')
  RETURNING id INTO _o_forecast;
  INSERT INTO public.order_lines (order_id, vendor_id, quantity, unit_price_excl_vat, unit_price_incl_vat, vat_rate, line_total_excl_vat, line_total_incl_vat)
  VALUES (_o_forecast, _vendor, 1, 200, 242, 21, 200, 242);

  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal_excl_vat, total_incl_vat, is_test, created_at)
  VALUES (gen_random_uuid(), _marker || '_ts', _customer, 'confirmed', 300, 363, true, _year_start + interval '13 days')
  RETURNING id INTO _o_test;
  INSERT INTO public.order_lines (order_id, vendor_id, quantity, unit_price_excl_vat, unit_price_incl_vat, vat_rate, line_total_excl_vat, line_total_incl_vat)
  VALUES (_o_test, _vendor, 1, 300, 363, 21, 300, 363);

  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal_excl_vat, total_incl_vat, hidden_from_list, created_at)
  VALUES (gen_random_uuid(), _marker || '_hd', _customer, 'delivered', 400, 484, true, _year_start + interval '14 days')
  RETURNING id INTO _o_hidden;
  INSERT INTO public.order_lines (order_id, vendor_id, quantity, unit_price_excl_vat, unit_price_incl_vat, vat_rate, line_total_excl_vat, line_total_incl_vat)
  VALUES (_o_hidden, _vendor, 1, 400, 484, 21, 400, 484);

  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal_excl_vat, total_incl_vat, deleted_at, created_at)
  VALUES (gen_random_uuid(), _marker || '_dl', _customer, 'delivered', 250, 302.50, now(), _year_start + interval '15 days')
  RETURNING id INTO _o_deleted;
  INSERT INTO public.order_lines (order_id, vendor_id, quantity, unit_price_excl_vat, unit_price_incl_vat, vat_rate, line_total_excl_vat, line_total_incl_vat)
  VALUES (_o_deleted, _vendor, 1, 250, 302.50, 21, 250, 302.50);

  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal_excl_vat, total_incl_vat, created_at)
  VALUES (gen_random_uuid(), _marker || '_py', _customer, 'delivered', 999, 1208.79, _prior_year - interval '30 days')
  RETURNING id INTO _o_prior;
  INSERT INTO public.order_lines (order_id, vendor_id, quantity, unit_price_excl_vat, unit_price_incl_vat, vat_rate, line_total_excl_vat, line_total_incl_vat)
  VALUES (_o_prior, _vendor, 1, 999, 1208.79, 21, 999, 1208.79);

  -- (a) Filtres du hook rejoués côté SQL
  SELECT COALESCE(ROUND(SUM(ol.line_total_excl_vat) * 100), 0)::bigint
    INTO _hook_cents
  FROM public.order_lines ol
  JOIN public.orders o ON o.id = ol.order_id
  WHERE ol.vendor_id = _vendor
    AND COALESCE(o.is_forecast, false) = false
    AND COALESCE(o.is_test, false) = false
    AND COALESCE(o.hidden_from_list, false) = false
    AND o.deleted_at IS NULL
    AND lower(o.status::text) NOT IN ('cancelled','canceled','refused','rejected','refunded','failed')
    AND o.created_at >= _year_start
    AND o.created_at <  _year_end;

  scenario := 'Hook filters (SQL replay) return only the delivered line HTVA';
  expected := _expected_cents; actual := _hook_cents; ok := (_hook_cents = _expected_cents);
  details := 'attendu 50000 cents (500 EUR HTVA), obtenu ' || _hook_cents::text;
  RETURN NEXT;

  -- (b) RPC canonique avec impersonation
  _prev_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', _owner_uid::text, 'role', 'authenticated')::text,
                     true);
  BEGIN
    SELECT public.get_vendor_gmv_progress(_vendor) INTO _progress;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', COALESCE(_prev_claims, ''), true);
    RAISE;
  END;
  PERFORM set_config('request.jwt.claims', COALESCE(_prev_claims, ''), true);

  _rpc_cents := COALESCE((_progress->>'current_gmv_cents')::bigint, 0);

  scenario := 'RPC get_vendor_gmv_progress returns the same HTVA total';
  expected := _expected_cents; actual := _rpc_cents; ok := (_rpc_cents = _expected_cents);
  details := 'current_gmv_cents = ' || _rpc_cents::text || ' | window = ' || COALESCE(_progress->>'gmv_window','?');
  RETURN NEXT;

  scenario := 'Hook SQL-replay == RPC (filter parity)';
  expected := _hook_cents; actual := _rpc_cents; ok := (_hook_cents = _rpc_cents);
  details := 'hook=' || _hook_cents::text || ' rpc=' || _rpc_cents::text;
  RETURN NEXT;

  scenario := 'RPC excludes forecast/test/hidden/deleted/cancelled/out-of-window orders';
  expected := 0;
  actual := CASE WHEN _rpc_cents = _expected_cents THEN 0 ELSE (_rpc_cents - _expected_cents) END;
  ok := (_rpc_cents = _expected_cents);
  details := 'leak_cents = ' || (actual)::text;
  RETURN NEXT;

  DELETE FROM public.order_lines WHERE order_id IN (_o_valid, _o_cancelled, _o_forecast, _o_test, _o_hidden, _o_deleted, _o_prior);
  DELETE FROM public.orders WHERE id IN (_o_valid, _o_cancelled, _o_forecast, _o_test, _o_hidden, _o_deleted, _o_prior);
  DELETE FROM public.margin_rules WHERE id = _rule;
  DELETE FROM public.customers WHERE id = _customer;
  DELETE FROM public.vendors WHERE id = _vendor;
END;
$$;
