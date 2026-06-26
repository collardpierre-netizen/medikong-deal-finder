
CREATE OR REPLACE FUNCTION public.sync_quote_to_forecast_order(_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_cust public.customers%ROWTYPE;
  v_order_id uuid; v_lines jsonb; v_addr jsonb;
  v_pm public.payment_method_enum;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = _quote_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_pm := CASE WHEN v_quote.payment_method = 'stripe' THEN 'card'::public.payment_method_enum
               ELSE 'invoice'::public.payment_method_enum END;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ql.id::text, 'mode','free',
    'offer_id', ql.offer_id, 'product_id', ql.product_id,
    'quantity', ql.qty, 'vat_rate', ql.vat_rate,
    'vendor_id', v_quote.vendor_id,
    'offer_label', NULL, 'manual_label', ql.label,
    'unit_price_excl_vat', (ql.unit_price_ht_cents::numeric / 100.0),
    'unit_cost_excl_vat', CASE WHEN ql.unit_cost_ht_cents IS NULL THEN ''
                               ELSE (ql.unit_cost_ht_cents::numeric / 100.0)::text END,
    'commission_rate','', 'commission_basis','margin', 'commission_amount',''
  ) ORDER BY ql.sort_order, ql.created_at), '[]'::jsonb)
  INTO v_lines FROM public.quote_lines ql WHERE ql.quote_id = _quote_id;

  SELECT * INTO v_cust FROM public.customers WHERE id = v_quote.customer_id;
  v_addr := jsonb_build_object(
    'company_name', v_cust.company_name, 'email', v_cust.email,
    'address_line1', v_cust.address_line1, 'city', v_cust.city,
    'postal_code', v_cust.postal_code, 'country_code', v_cust.country_code,
    'vat_number', v_cust.vat_number);

  IF v_quote.order_id IS NOT NULL THEN
    UPDATE public.orders SET
      customer_id = v_quote.customer_id,
      subtotal_excl_vat = v_quote.total_ht_cents/100.0,
      vat_amount = v_quote.total_tva_cents/100.0,
      total_incl_vat = v_quote.total_ttc_cents/100.0,
      billing_address = v_addr,
      shipping_address = COALESCE(shipping_address, v_addr),
      draft_payload = jsonb_build_object(
        '_source_quote_id', v_quote.id,
        '_source_quote_number', v_quote.quote_number,
        'lines', v_lines),
      admin_notes = COALESCE(admin_notes, 'Issu du devis ' || v_quote.quote_number),
      updated_at = now()
    WHERE id = v_quote.order_id AND (is_forecast = true OR status = 'draft');
    RETURN v_quote.order_id;
  END IF;

  INSERT INTO public.orders (
    order_number, customer_id, source, status,
    subtotal_excl_vat, vat_amount, total_incl_vat,
    shipping_address, billing_address,
    payment_method, payment_status,
    notes, admin_notes, created_by_admin,
    is_forecast, forecast_created_at, draft_payload
  ) VALUES (
    'MK-Q-' || v_quote.quote_number, v_quote.customer_id,
    'manual_admin'::public.order_source, 'draft'::public.order_status,
    v_quote.total_ht_cents/100.0, v_quote.total_tva_cents/100.0, v_quote.total_ttc_cents/100.0,
    v_addr, v_addr,
    v_pm, 'pending'::public.payment_status_enum,
    v_quote.notes_customer, 'Issu du devis ' || v_quote.quote_number,
    v_quote.created_by_user_id,
    true, now(),
    jsonb_build_object(
      '_source_quote_id', v_quote.id,
      '_source_quote_number', v_quote.quote_number,
      'lines', v_lines)
  ) RETURNING id INTO v_order_id;

  UPDATE public.quotes SET order_id = v_order_id WHERE id = v_quote.id;
  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._tg_quotes_sync_forecast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('declined','expired') AND NEW.order_id IS NOT NULL THEN
    UPDATE public.orders
       SET status = 'cancelled'::public.order_status,
           hidden_from_list = true,
           admin_notes = COALESCE(admin_notes,'') || ' [Devis ' || NEW.quote_number || ' ' || NEW.status::text || ']',
           updated_at = now()
     WHERE id = NEW.order_id AND (is_forecast = true OR status = 'draft');
    RETURN NEW;
  END IF;
  IF NEW.status IN ('sent','accepted') THEN
    PERFORM public.sync_quote_to_forecast_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_sync_forecast ON public.quotes;
CREATE TRIGGER trg_quotes_sync_forecast
AFTER INSERT OR UPDATE OF status, total_ht_cents, total_tva_cents, total_ttc_cents, customer_id
ON public.quotes FOR EACH ROW EXECUTE FUNCTION public._tg_quotes_sync_forecast();

CREATE OR REPLACE FUNCTION public._tg_quote_lines_resync_forecast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_qid uuid; v_status public.quote_status;
BEGIN
  v_qid := COALESCE(NEW.quote_id, OLD.quote_id);
  SELECT status INTO v_status FROM public.quotes WHERE id = v_qid;
  IF v_status IN ('sent','accepted') THEN
    PERFORM public.sync_quote_to_forecast_order(v_qid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_lines_resync_forecast ON public.quote_lines;
CREATE TRIGGER trg_quote_lines_resync_forecast
AFTER INSERT OR UPDATE OR DELETE ON public.quote_lines
FOR EACH ROW EXECUTE FUNCTION public._tg_quote_lines_resync_forecast();

CREATE OR REPLACE FUNCTION public.convert_quote_to_order(_quote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      quantity, unit_price_excl_vat, vat_rate, total_excl_vat, total_incl_vat
    ) VALUES (
      v_order_id, v_line.product_id, v_line.offer_id, v_quote.vendor_id, v_line.label,
      v_line.qty, v_line.unit_price_ht_cents/100.0, v_line.vat_rate,
      v_line.total_ht_cents/100.0, v_line.total_ttc_cents/100.0);
  END LOOP;

  UPDATE public.quotes SET status='converted'::public.quote_status,
         order_id=v_order_id, converted_at=now(), updated_at=now() WHERE id=_quote_id;
  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id);
END;
$$;

DO $$ DECLARE q record;
BEGIN
  FOR q IN SELECT id FROM public.quotes WHERE status IN ('sent','accepted') AND order_id IS NULL LOOP
    PERFORM public.sync_quote_to_forecast_order(q.id);
  END LOOP;
END $$;
