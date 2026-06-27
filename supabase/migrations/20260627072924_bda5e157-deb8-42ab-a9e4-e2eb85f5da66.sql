
CREATE OR REPLACE FUNCTION public.convert_quote_to_order(_quote_id uuid, _force boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      quantity, unit_price_excl_vat, vat_rate, total_excl_vat, total_incl_vat
    ) VALUES (
      v_order_id, v_line.product_id, v_line.offer_id, v_quote.vendor_id, v_line.label,
      v_line.qty, v_line.unit_price_ht_cents/100.0, v_line.vat_rate,
      v_line.total_ht_cents/100.0, v_line.total_ttc_cents/100.0);
  END LOOP;

  UPDATE public.quotes SET status='converted'::public.quote_status,
         order_id=v_order_id, converted_at=now(), updated_at=now() WHERE id=_quote_id;
  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'forced', _force AND v_quote.status<>'paid');
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_quote_to_order(uuid, boolean) TO authenticated;
