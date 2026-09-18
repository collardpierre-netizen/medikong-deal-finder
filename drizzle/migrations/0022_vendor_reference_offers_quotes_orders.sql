-- 0022_vendor_reference_offers_quotes_orders
ALTER TABLE public.offers      ADD COLUMN IF NOT EXISTS vendor_reference text;
ALTER TABLE public.quote_lines ADD COLUMN IF NOT EXISTS vendor_reference text;
ALTER TABLE public.order_lines ADD COLUMN IF NOT EXISTS vendor_reference text;

COMMENT ON COLUMN public.offers.vendor_reference      IS 'Référence produit propre au vendeur (son SKU interne).';
COMMENT ON COLUMN public.quote_lines.vendor_reference IS 'Référence vendeur saisie/copiée sur la ligne de devis.';
COMMENT ON COLUMN public.order_lines.vendor_reference IS 'Snapshot de la référence vendeur au moment de la commande.';

CREATE OR REPLACE FUNCTION public.admin_create_quote_from_payload(_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_quote_id uuid;
  v_token text;
  v_expires timestamptz;
  v_line jsonb;
  v_sort int := 0;
  v_validity_days int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _payload->>'vendor_id' IS NULL OR _payload->>'customer_id' IS NULL THEN
    RAISE EXCEPTION 'vendor_id and customer_id are required';
  END IF;

  IF _payload->'lines' IS NULL OR jsonb_array_length(_payload->'lines') = 0 THEN
    RAISE EXCEPTION 'at least one line is required';
  END IF;

  v_validity_days := COALESCE((_payload->>'validity_days')::int, 7);
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires := now() + (v_validity_days || ' days')::interval;

  INSERT INTO public.quotes (
    vendor_id, customer_id, created_by_user_id,
    status, payment_method, currency_code,
    public_token, token_expires_at,
    notes_internal, notes_customer
  ) VALUES (
    (_payload->>'vendor_id')::uuid,
    (_payload->>'customer_id')::uuid,
    auth.uid(),
    'draft'::quote_status,
    COALESCE((_payload->>'payment_method')::quote_payment_method, 'invoice'::quote_payment_method),
    COALESCE(_payload->>'currency_code', 'EUR'),
    v_token,
    v_expires,
    _payload->>'notes_internal',
    _payload->>'notes_customer'
  )
  RETURNING id INTO v_quote_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_payload->'lines')
  LOOP
    v_sort := v_sort + 1;
    INSERT INTO public.quote_lines (
      quote_id, product_id, offer_id, label,
      qty, unit_price_ht_cents, vat_rate,
      unit_cost_ht_cents, sort_order, vendor_reference
    ) VALUES (
      v_quote_id,
      NULLIF(v_line->>'product_id','')::uuid,
      NULLIF(v_line->>'offer_id','')::uuid,
      COALESCE(v_line->>'label', 'Article'),
      GREATEST(1, COALESCE((v_line->>'qty')::int, 1)),
      COALESCE((v_line->>'unit_price_ht_cents')::bigint, 0),
      COALESCE((v_line->>'vat_rate')::numeric, 21),
      NULLIF(v_line->>'unit_cost_ht_cents','')::bigint,
      COALESCE((v_line->>'sort_order')::int, v_sort),
      NULLIF(v_line->>'vendor_reference','')
    );
  END LOOP;

  PERFORM public.recompute_quote_totals(v_quote_id);

  RETURN jsonb_build_object(
    'quote_id', v_quote_id,
    'public_token', v_token,
    'token_expires_at', v_expires
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_quote_from_payload(_quote_id uuid, _payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_status quote_status;
  v_line jsonb;
  v_sort int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'quote not found'; END IF;
  IF v_status <> 'draft'::quote_status THEN
    RAISE EXCEPTION 'only draft quotes can be edited (current: %)', v_status;
  END IF;

  IF _payload->'lines' IS NULL OR jsonb_array_length(_payload->'lines') = 0 THEN
    RAISE EXCEPTION 'at least one line is required';
  END IF;

  UPDATE public.quotes SET
    vendor_id     = COALESCE(NULLIF(_payload->>'vendor_id','')::uuid, vendor_id),
    customer_id   = COALESCE(NULLIF(_payload->>'customer_id','')::uuid, customer_id),
    payment_method= COALESCE((_payload->>'payment_method')::quote_payment_method, payment_method),
    currency_code = COALESCE(_payload->>'currency_code', currency_code),
    notes_internal= _payload->>'notes_internal',
    notes_customer= _payload->>'notes_customer',
    token_expires_at = CASE
      WHEN (_payload->>'validity_days') IS NOT NULL
        THEN now() + ((_payload->>'validity_days')::int || ' days')::interval
      ELSE token_expires_at
    END,
    updated_at = now()
  WHERE id = _quote_id;

  DELETE FROM public.quote_lines WHERE quote_id = _quote_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_payload->'lines') LOOP
    v_sort := v_sort + 1;
    INSERT INTO public.quote_lines (
      quote_id, product_id, offer_id, label,
      qty, unit_price_ht_cents, vat_rate,
      unit_cost_ht_cents, sort_order,
      commission_rate, commission_amount_cents, commission_basis,
      vendor_reference
    ) VALUES (
      _quote_id,
      NULLIF(v_line->>'product_id','')::uuid,
      NULLIF(v_line->>'offer_id','')::uuid,
      COALESCE(v_line->>'label', 'Article'),
      GREATEST(1, COALESCE((v_line->>'qty')::int, 1)),
      COALESCE((v_line->>'unit_price_ht_cents')::bigint, 0),
      COALESCE((v_line->>'vat_rate')::numeric, 21),
      NULLIF(v_line->>'unit_cost_ht_cents','')::bigint,
      COALESCE((v_line->>'sort_order')::int, v_sort),
      NULLIF(v_line->>'commission_rate','')::numeric,
      NULLIF(v_line->>'commission_amount_cents','')::bigint,
      NULLIF(v_line->>'commission_basis',''),
      NULLIF(v_line->>'vendor_reference','')
    );
  END LOOP;

  PERFORM public.recompute_quote_totals(_quote_id);
  PERFORM public.sync_quote_to_forecast_order(_quote_id);

  RETURN jsonb_build_object('quote_id', _quote_id, 'updated_at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_duplicate_quote(_quote_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _new_id uuid;
  _src quotes%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _src FROM public.quotes WHERE id = _quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quote not found';
  END IF;

  INSERT INTO public.quotes (
    vendor_id, customer_id, created_by_user_id, status, payment_method,
    currency_code, notes_internal, notes_customer
  ) VALUES (
    _src.vendor_id, _src.customer_id, auth.uid(), 'draft', _src.payment_method,
    _src.currency_code, _src.notes_internal, _src.notes_customer
  )
  RETURNING id INTO _new_id;

  INSERT INTO public.quote_lines (
    quote_id, product_id, offer_id, label, qty,
    unit_price_ht_cents, vat_rate, unit_cost_ht_cents, sort_order, vendor_reference
  )
  SELECT _new_id, product_id, offer_id, label, qty,
         unit_price_ht_cents, vat_rate, unit_cost_ht_cents, sort_order, vendor_reference
  FROM public.quote_lines
  WHERE quote_id = _quote_id;

  RETURN _new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.convert_quote_to_order(_quote_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_order_id uuid; v_order_number text; v_line record;
  v_billing jsonb; v_shipping jsonb; v_is_forecast boolean;
  v_pm public.payment_method_enum;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.quotes q WHERE q.id = _quote_id AND q.vendor_id = public.current_vendor_id()
  )) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF v_quote.status <> 'paid' THEN
    RETURN jsonb_build_object('error','not_paid','status', v_quote.status::text);
  END IF;

  v_pm := CASE WHEN v_quote.payment_method='stripe' THEN 'card'::public.payment_method_enum
               ELSE 'invoice'::public.payment_method_enum END;

  SELECT * INTO v_customer FROM public.customers WHERE id = v_quote.customer_id;
  v_billing := jsonb_build_object(
    'company_name', v_customer.company_name, 'email', v_customer.email,
    'address_line1', v_customer.address_line1, 'city', v_customer.city,
    'postal_code', v_customer.postal_code, 'country_code', v_customer.country_code,
    'vat_number', v_customer.vat_number);
  v_shipping := v_billing;

  IF v_quote.order_id IS NOT NULL THEN
    SELECT is_forecast INTO v_is_forecast FROM public.orders WHERE id = v_quote.order_id;
    IF v_is_forecast IS TRUE THEN
      UPDATE public.orders SET
        status = 'confirmed'::public.order_status,
        payment_status = 'paid'::public.payment_status_enum,
        subtotal_excl_vat = v_quote.total_ht_cents/100.0,
        vat_amount = v_quote.total_tva_cents/100.0,
        total_incl_vat = v_quote.total_ttc_cents/100.0,
        billing_address = v_billing,
        shipping_address = COALESCE(shipping_address, v_shipping),
        is_forecast = false, was_forecast = true,
        forecast_converted_at = now(),
        admin_notes = COALESCE(admin_notes,'') || ' [Converti depuis devis ' || v_quote.quote_number || ']',
        updated_at = now()
      WHERE id = v_quote.order_id;
      UPDATE public.quotes SET status='converted'::public.quote_status,
             converted_at=now(), updated_at=now() WHERE id=_quote_id;
      RETURN jsonb_build_object('ok', true, 'order_id', v_quote.order_id, 'promoted', true);
    ELSE
      RETURN jsonb_build_object('ok', true, 'order_id', v_quote.order_id, 'already_converted', true);
    END IF;
  END IF;

  v_order_number := 'MK-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.quote_number_seq')::text,5,'0');
  INSERT INTO public.orders (
    order_number, customer_id, source, status,
    subtotal_excl_vat, vat_amount, total_incl_vat,
    shipping_address, billing_address, payment_method, payment_status,
    notes, admin_notes, created_by_admin, is_forecast
  ) VALUES (
    v_order_number, v_quote.customer_id,
    'manual_admin'::public.order_source, 'confirmed'::public.order_status,
    v_quote.total_ht_cents/100.0, v_quote.total_tva_cents/100.0, v_quote.total_ttc_cents/100.0,
    v_shipping, v_billing, v_pm, 'paid'::public.payment_status_enum,
    v_quote.notes_customer, 'Converti depuis devis '||v_quote.quote_number,
    v_quote.created_by_user_id, false
  ) RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM public.quote_lines WHERE quote_id=_quote_id ORDER BY sort_order, created_at LOOP
    INSERT INTO public.order_lines (
      order_id, product_id, offer_id, vendor_id, product_name,
      quantity, unit_price_excl_vat, vat_rate, total_excl_vat, total_incl_vat,
      vendor_reference
    ) VALUES (
      v_order_id, v_line.product_id, v_line.offer_id, v_quote.vendor_id, v_line.label,
      v_line.qty, v_line.unit_price_ht_cents/100.0, v_line.vat_rate,
      v_line.total_ht_cents/100.0, v_line.total_ttc_cents/100.0,
      v_line.vendor_reference);
  END LOOP;

  UPDATE public.quotes SET status='converted'::public.quote_status,
         order_id=v_order_id, converted_at=now(), updated_at=now() WHERE id=_quote_id;
  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.convert_quote_to_order(_quote_id uuid, _force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_order_id uuid; v_order_number text; v_line record;
  v_billing jsonb; v_shipping jsonb; v_is_forecast boolean;
  v_pm public.payment_method_enum;
  v_is_admin boolean;
BEGIN
  v_is_admin := public.is_admin(auth.uid());
  IF NOT (v_is_admin OR EXISTS (
    SELECT 1 FROM public.quotes q WHERE q.id = _quote_id AND q.vendor_id = public.current_vendor_id()
  )) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;

  -- Force-conversion réservée aux admins
  IF v_quote.status <> 'paid' AND NOT (_force AND v_is_admin) THEN
    RETURN jsonb_build_object('error','not_paid','status', v_quote.status::text);
  END IF;

  IF v_quote.status = 'converted' AND v_quote.order_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'order_id', v_quote.order_id, 'already_converted', true);
  END IF;

  v_pm := CASE WHEN v_quote.payment_method='stripe' THEN 'card'::public.payment_method_enum
               ELSE 'invoice'::public.payment_method_enum END;

  SELECT * INTO v_customer FROM public.customers WHERE id = v_quote.customer_id;
  v_billing := jsonb_build_object(
    'company_name', v_customer.company_name, 'email', v_customer.email,
    'address_line1', v_customer.address_line1, 'city', v_customer.city,
    'postal_code', v_customer.postal_code, 'country_code', v_customer.country_code,
    'vat_number', v_customer.vat_number);
  v_shipping := v_billing;

  IF v_quote.order_id IS NOT NULL THEN
    SELECT is_forecast INTO v_is_forecast FROM public.orders WHERE id = v_quote.order_id;
    IF v_is_forecast IS TRUE THEN
      UPDATE public.orders SET
        status = 'confirmed'::public.order_status,
        payment_status = CASE WHEN v_quote.status='paid' THEN 'paid'::public.payment_status_enum ELSE 'pending'::public.payment_status_enum END,
        subtotal_excl_vat = v_quote.total_ht_cents/100.0,
        vat_amount = v_quote.total_tva_cents/100.0,
        total_incl_vat = v_quote.total_ttc_cents/100.0,
        billing_address = v_billing,
        shipping_address = COALESCE(shipping_address, v_shipping),
        is_forecast = false, was_forecast = true,
        forecast_converted_at = now(),
        admin_notes = COALESCE(admin_notes,'') || ' [Converti' || CASE WHEN _force AND v_quote.status<>'paid' THEN ' (manuel, statut '||v_quote.status::text||')' ELSE '' END || ' depuis devis ' || v_quote.quote_number || ']',
        updated_at = now()
      WHERE id = v_quote.order_id;
      UPDATE public.quotes SET status='converted'::public.quote_status,
             converted_at=now(), updated_at=now() WHERE id=_quote_id;
      RETURN jsonb_build_object('ok', true, 'order_id', v_quote.order_id, 'promoted', true, 'forced', _force AND v_quote.status<>'paid');
    ELSE
      RETURN jsonb_build_object('ok', true, 'order_id', v_quote.order_id, 'already_converted', true);
    END IF;
  END IF;

  v_order_number := 'MK-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.quote_number_seq')::text,5,'0');
  INSERT INTO public.orders (
    order_number, customer_id, source, status,
    subtotal_excl_vat, vat_amount, total_incl_vat,
    shipping_address, billing_address, payment_method, payment_status,
    notes, admin_notes, created_by_admin, is_forecast
  ) VALUES (
    v_order_number, v_quote.customer_id,
    'manual_admin'::public.order_source, 'confirmed'::public.order_status,
    v_quote.total_ht_cents/100.0, v_quote.total_tva_cents/100.0, v_quote.total_ttc_cents/100.0,
    v_shipping, v_billing, v_pm,
    CASE WHEN v_quote.status='paid' THEN 'paid'::public.payment_status_enum ELSE 'pending'::public.payment_status_enum END,
    v_quote.notes_customer,
    'Converti' || CASE WHEN _force AND v_quote.status<>'paid' THEN ' (manuel, statut '||v_quote.status::text||')' ELSE '' END || ' depuis devis '||v_quote.quote_number,
    v_quote.created_by_user_id, false
  ) RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM public.quote_lines WHERE quote_id=_quote_id ORDER BY sort_order, created_at LOOP
    INSERT INTO public.order_lines (
      order_id, product_id, offer_id, vendor_id, product_name,
      quantity, unit_price_excl_vat, vat_rate, total_excl_vat, total_incl_vat,
      vendor_reference
    ) VALUES (
      v_order_id, v_line.product_id, v_line.offer_id, v_quote.vendor_id, v_line.label,
      v_line.qty, v_line.unit_price_ht_cents/100.0, v_line.vat_rate,
      v_line.total_ht_cents/100.0, v_line.total_ttc_cents/100.0,
      v_line.vendor_reference);
  END LOOP;

  UPDATE public.quotes SET status='converted'::public.quote_status,
         order_id=v_order_id, converted_at=now(), updated_at=now() WHERE id=_quote_id;
  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'forced', _force AND v_quote.status<>'paid');
END;
$function$;