
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS public_token text UNIQUE;

CREATE OR REPLACE FUNCTION public.admin_ensure_order_public_token(_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT public_token INTO v_token FROM public.orders WHERE id = _order_id;
  IF v_token IS NULL THEN
    v_token := encode(extensions.gen_random_bytes(18), 'hex');
    UPDATE public.orders SET public_token = v_token WHERE id = _order_id;
  END IF;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_get_order_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_customer jsonb;
  v_lines jsonb;
  v_vendor_bank jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE public_token = _token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(c) - 'created_at' - 'updated_at'
    INTO v_customer
    FROM public.customers c WHERE c.id = v_order.customer_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ol.id,
    'quantity', ol.quantity,
    'unit_price_excl_vat', ol.unit_price_excl_vat,
    'vat_rate', ol.vat_rate,
    'line_total_excl_vat', ol.line_total_excl_vat,
    'manual_label', ol.manual_label,
    'product_name', p.name,
    'vendor_name', coalesce(v.company_name, v.name)
  ) ORDER BY ol.created_at), '[]'::jsonb)
  INTO v_lines
  FROM public.order_lines ol
  LEFT JOIN public.products p ON p.id = ol.product_id
  LEFT JOIN public.vendors v ON v.id = ol.vendor_id
  WHERE ol.order_id = v_order.id;

  SELECT to_jsonb(v) - 'created_at' - 'updated_at' - 'auth_user_id' - 'email'
    INTO v_vendor_bank
    FROM public.vendors v
    JOIN public.order_lines ol ON ol.vendor_id = v.id
    WHERE ol.order_id = v_order.id AND (v.iban IS NOT NULL OR v.bank_name IS NOT NULL)
    LIMIT 1;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'subtotal_excl_vat', v_order.subtotal_excl_vat,
    'vat_amount', v_order.vat_amount,
    'total_incl_vat', v_order.total_incl_vat,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'payment_due_date', v_order.payment_due_date,
    'notes', v_order.notes,
    'is_forecast', v_order.is_forecast,
    'customer', v_customer,
    'lines', v_lines,
    'vendor_bank', v_vendor_bank,
    'draft_payload', v_order.draft_payload
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_ensure_order_public_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_order_by_token(text) TO anon, authenticated;
