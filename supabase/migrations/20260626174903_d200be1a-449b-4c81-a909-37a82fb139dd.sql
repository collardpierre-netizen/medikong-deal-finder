
-- 1. Columns
ALTER TABLE public.quote_lines
  ADD COLUMN IF NOT EXISTS commission_rate numeric,
  ADD COLUMN IF NOT EXISTS commission_amount_cents bigint,
  ADD COLUMN IF NOT EXISTS commission_basis text;

ALTER TABLE public.quote_lines
  DROP CONSTRAINT IF EXISTS quote_lines_commission_basis_check;
ALTER TABLE public.quote_lines
  ADD CONSTRAINT quote_lines_commission_basis_check
  CHECK (commission_basis IS NULL OR commission_basis IN ('ca','margin'));

-- 2. sync_quote_to_forecast_order : propage commission_rate / commission_amount / commission_basis
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
    'commission_rate',
      CASE WHEN ql.commission_rate IS NULL THEN '' ELSE ql.commission_rate::text END,
    'commission_basis', COALESCE(ql.commission_basis, 'margin'),
    'commission_amount',
      CASE WHEN ql.commission_amount_cents IS NULL THEN ''
           ELSE (ql.commission_amount_cents::numeric / 100.0)::text END
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

-- 3. admin_update_quote_from_payload : lire commission_*
CREATE OR REPLACE FUNCTION public.admin_update_quote_from_payload(_quote_id uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
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
      commission_rate, commission_amount_cents, commission_basis
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
      NULLIF(v_line->>'commission_basis','')
    );
  END LOOP;

  PERFORM public.recompute_quote_totals(_quote_id);
  PERFORM public.sync_quote_to_forecast_order(_quote_id);

  RETURN jsonb_build_object('quote_id', _quote_id, 'updated_at', now());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_update_quote_from_payload(uuid, jsonb) TO authenticated;

-- 4. admin_update_quote_line : ajout des params commission_* (signature étendue → drop+create)
DROP FUNCTION IF EXISTS public.admin_update_quote_line(uuid, int, bigint, numeric, text);

CREATE OR REPLACE FUNCTION public.admin_update_quote_line(
  _line_id uuid,
  _qty int,
  _unit_price_ht_cents bigint,
  _vat_rate numeric,
  _label text DEFAULT NULL,
  _commission_rate numeric DEFAULT NULL,
  _commission_amount_cents bigint DEFAULT NULL,
  _commission_basis text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_quote_id uuid;
  v_status quote_status;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT ql.quote_id, q.status INTO v_quote_id, v_status
  FROM public.quote_lines ql JOIN public.quotes q ON q.id = ql.quote_id
  WHERE ql.id = _line_id
  FOR UPDATE OF ql;

  IF v_quote_id IS NULL THEN RAISE EXCEPTION 'line not found'; END IF;
  IF v_status <> 'draft'::quote_status THEN
    RAISE EXCEPTION 'only draft quotes can be edited (current: %)', v_status;
  END IF;

  UPDATE public.quote_lines SET
    qty = GREATEST(1, COALESCE(_qty, qty)),
    unit_price_ht_cents = COALESCE(_unit_price_ht_cents, unit_price_ht_cents),
    vat_rate = COALESCE(_vat_rate, vat_rate),
    label = COALESCE(_label, label),
    commission_rate = _commission_rate,
    commission_amount_cents = _commission_amount_cents,
    commission_basis = _commission_basis,
    updated_at = now()
  WHERE id = _line_id;

  PERFORM public.recompute_quote_totals(v_quote_id);
  PERFORM public.sync_quote_to_forecast_order(v_quote_id);
  RETURN jsonb_build_object('line_id', _line_id, 'quote_id', v_quote_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_update_quote_line(uuid, int, bigint, numeric, text, numeric, bigint, text) TO authenticated;

-- 5. Resync existing sent/accepted quotes to refresh draft_payload with new commission keys
DO $$ DECLARE q record;
BEGIN
  FOR q IN SELECT id FROM public.quotes WHERE status IN ('sent','accepted') LOOP
    PERFORM public.sync_quote_to_forecast_order(q.id);
  END LOOP;
END $$;
