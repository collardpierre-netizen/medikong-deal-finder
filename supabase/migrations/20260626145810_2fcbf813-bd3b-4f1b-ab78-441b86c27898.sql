
CREATE OR REPLACE FUNCTION public.admin_duplicate_quote(_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    unit_price_ht_cents, vat_rate, unit_cost_ht_cents, sort_order
  )
  SELECT _new_id, product_id, offer_id, label, qty,
         unit_price_ht_cents, vat_rate, unit_cost_ht_cents, sort_order
  FROM public.quote_lines
  WHERE quote_id = _quote_id;

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_duplicate_quote(uuid) TO authenticated;
