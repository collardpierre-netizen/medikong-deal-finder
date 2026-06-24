
CREATE OR REPLACE FUNCTION public.admin_create_quote_from_payload(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_token := encode(gen_random_bytes(24), 'hex');
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
      unit_cost_ht_cents, sort_order
    ) VALUES (
      v_quote_id,
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

  PERFORM public.recompute_quote_totals(v_quote_id);

  RETURN jsonb_build_object(
    'quote_id', v_quote_id,
    'public_token', v_token,
    'token_expires_at', v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_quote_from_payload(jsonb) TO authenticated;
