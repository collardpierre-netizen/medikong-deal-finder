-- RPC: full update of a draft quote (header + replace lines)
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
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'quote not found';
  END IF;
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

  FOR v_line IN SELECT * FROM jsonb_array_elements(_payload->'lines')
  LOOP
    v_sort := v_sort + 1;
    INSERT INTO public.quote_lines (
      quote_id, product_id, offer_id, label,
      qty, unit_price_ht_cents, vat_rate,
      unit_cost_ht_cents, sort_order
    ) VALUES (
      _quote_id,
      NULLIF(v_line->>'product_id','')::uuid,
      NULLIF(v_line->>'offer_id','')::uuid,
      COALESCE(v_line->>'label', 'Article'),
      GREATEST(1, COALESCE((v_line->>'qty')::int, 1)),
      COALESCE((v_line->>'unit_price_ht_cents')::bigint, 0),
      COALESCE((v_line->>'vat_rate')::numeric, 21),
      NULLIF(v_line->>'unit_cost_ht_cents','')::bigint,
      COALESCE((v_line->>'sort_order')::int, v_sort)
    );
  END LOOP;

  PERFORM public.recompute_quote_totals(_quote_id);

  RETURN jsonb_build_object('quote_id', _quote_id, 'updated_at', now());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_update_quote_from_payload(uuid, jsonb) TO authenticated;

-- RPC: inline edit of a single line on a draft quote
CREATE OR REPLACE FUNCTION public.admin_update_quote_line(
  _line_id uuid,
  _qty int,
  _unit_price_ht_cents bigint,
  _vat_rate numeric,
  _label text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
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

  IF v_quote_id IS NULL THEN
    RAISE EXCEPTION 'line not found';
  END IF;
  IF v_status <> 'draft'::quote_status THEN
    RAISE EXCEPTION 'only draft quotes can be edited (current: %)', v_status;
  END IF;

  UPDATE public.quote_lines SET
    qty = GREATEST(1, COALESCE(_qty, qty)),
    unit_price_ht_cents = COALESCE(_unit_price_ht_cents, unit_price_ht_cents),
    vat_rate = COALESCE(_vat_rate, vat_rate),
    label = COALESCE(_label, label),
    updated_at = now()
  WHERE id = _line_id;

  PERFORM public.recompute_quote_totals(v_quote_id);
  RETURN jsonb_build_object('line_id', _line_id, 'quote_id', v_quote_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_update_quote_line(uuid, int, bigint, numeric, text) TO authenticated;

-- RPC: delete a line from a draft quote
CREATE OR REPLACE FUNCTION public.admin_delete_quote_line(_line_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_quote_id uuid;
  v_status quote_status;
  v_count int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT ql.quote_id, q.status INTO v_quote_id, v_status
  FROM public.quote_lines ql JOIN public.quotes q ON q.id = ql.quote_id
  WHERE ql.id = _line_id;

  IF v_quote_id IS NULL THEN RAISE EXCEPTION 'line not found'; END IF;
  IF v_status <> 'draft'::quote_status THEN
    RAISE EXCEPTION 'only draft quotes can be edited';
  END IF;

  SELECT count(*) INTO v_count FROM public.quote_lines WHERE quote_id = v_quote_id;
  IF v_count <= 1 THEN
    RAISE EXCEPTION 'cannot delete the last line of a quote';
  END IF;

  DELETE FROM public.quote_lines WHERE id = _line_id;
  PERFORM public.recompute_quote_totals(v_quote_id);
  RETURN jsonb_build_object('deleted', _line_id, 'quote_id', v_quote_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_delete_quote_line(uuid) TO authenticated;