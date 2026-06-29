CREATE OR REPLACE FUNCTION public.order_should_show_payment_info(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(show_payment_info, true)
  FROM public.orders
  WHERE id = _order_id
$$;

GRANT EXECUTE ON FUNCTION public.order_should_show_payment_info(uuid) TO anon, authenticated, service_role;

-- Refactor public_get_order_by_token to use the helper (single source of truth)
CREATE OR REPLACE FUNCTION public.public_get_order_by_token(_token text, _pin text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token RECORD;
  v_order RECORD;
  v_lines jsonb;
  v_draft_lines jsonb;
  v_subtotal numeric;
  v_vat numeric;
  v_total numeric;
  v_vendor_bank jsonb;
  v_show_payment boolean;
BEGIN
  SELECT * INTO v_token FROM public.vendor_order_tokens WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'token_not_found'); END IF;
  IF v_token.expires_at IS NOT NULL AND v_token.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'token_expired');
  END IF;
  IF v_token.pin_code IS NOT NULL AND v_token.pin_code <> coalesce(_pin, '') THEN
    RETURN jsonb_build_object('error', 'pin_required');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_token.order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'order_not_found'); END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ol.id,
    'manual_label', coalesce(ol.manual_label, ol.offer_label, p.name),
    'product_name', p.name,
    'product_gtin', p.gtin,
    'product_cnk', p.cnk_code,
    'quantity', ol.quantity,
    'unit_price_excl_vat', ol.unit_price_excl_vat,
    'vat_rate', ol.vat_rate,
    'line_total_excl_vat', ol.line_total_excl_vat,
    'vendor_name', coalesce(v.company_name, v.name)
  ) ORDER BY ol.created_at), '[]'::jsonb)
  INTO v_lines
  FROM public.order_lines ol
  LEFT JOIN public.products p ON p.id = ol.product_id
  LEFT JOIN public.vendors v ON v.id = ol.vendor_id
  WHERE ol.order_id = v_order.id;

  IF (v_lines IS NULL OR v_lines = '[]'::jsonb)
     AND v_order.draft_payload IS NOT NULL
     AND jsonb_typeof(v_order.draft_payload->'lines') = 'array' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', idx,
      'manual_label', coalesce(l->>'manual_label', l->>'offer_label', p.name),
      'product_name', p.name,
      'product_gtin', p.gtin,
      'product_cnk', p.cnk_code,
      'quantity', (l->>'quantity')::numeric,
      'unit_price_excl_vat', (l->>'unit_price_excl_vat')::numeric,
      'vat_rate', (l->>'vat_rate')::numeric,
      'line_total_excl_vat', (l->>'line_total_excl_vat')::numeric,
      'vendor_name', coalesce(v.company_name, v.name)
    ) ORDER BY idx), '[]'::jsonb)
    INTO v_draft_lines
    FROM jsonb_array_elements(v_order.draft_payload->'lines') WITH ORDINALITY AS t(l, idx)
    LEFT JOIN public.products p ON p.id::text = (l->>'product_id')
    LEFT JOIN public.vendors v ON v.id::text = (l->>'vendor_id');
    v_lines := v_draft_lines;
    SELECT coalesce(sum((l->>'line_total_excl_vat')::numeric), 0),
           coalesce(sum((l->>'line_total_excl_vat')::numeric * (l->>'vat_rate')::numeric / 100.0), 0)
    INTO v_subtotal, v_vat FROM jsonb_array_elements(v_draft_lines) AS l;
    v_total := v_subtotal + v_vat;
  ELSE
    v_subtotal := coalesce(v_order.subtotal_excl_vat, 0);
    v_vat := coalesce(v_order.vat_amount, 0);
    v_total := coalesce(v_order.total_incl_vat, 0);
  END IF;

  -- Single source of truth: same helper used by the PDF edge functions
  v_show_payment := public.order_should_show_payment_info(v_order.id);

  IF v_show_payment THEN
    SELECT to_jsonb(v) - 'created_at' - 'updated_at' - 'auth_user_id' - 'email'
      INTO v_vendor_bank
      FROM public.vendors v
      JOIN public.order_lines ol ON ol.vendor_id = v.id
      WHERE ol.order_id = v_order.id AND (v.iban IS NOT NULL OR v.bank_name IS NOT NULL)
      LIMIT 1;

    IF v_vendor_bank IS NULL AND v_order.draft_payload IS NOT NULL
       AND jsonb_typeof(v_order.draft_payload->'lines') = 'array' THEN
      SELECT to_jsonb(vv) - 'created_at' - 'updated_at' - 'auth_user_id' - 'email'
        INTO v_vendor_bank FROM public.vendors vv
        WHERE vv.id::text IN (
          SELECT l->>'vendor_id' FROM jsonb_array_elements(v_order.draft_payload->'lines') AS l WHERE l->>'vendor_id' IS NOT NULL
        )
        AND (vv.iban IS NOT NULL OR vv.bank_name IS NOT NULL)
        LIMIT 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'order', to_jsonb(v_order),
    'lines', v_lines,
    'subtotal_excl_vat', v_subtotal,
    'vat_amount', v_vat,
    'total_incl_vat', v_total,
    'vendor_bank', v_vendor_bank,
    'show_payment_info', v_show_payment
  );
END;
$$;