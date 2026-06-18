
CREATE OR REPLACE FUNCTION public.vendor_update_order_line_status(
  _line_id uuid,
  _status text,
  _quantity_shipped integer DEFAULT NULL,
  _tracking_number text DEFAULT NULL,
  _tracking_url text DEFAULT NULL,
  _cancellation_reason text DEFAULT NULL,
  _refunded_amount_incl_vat numeric DEFAULT NULL
)
RETURNS public.order_lines
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _line public.order_lines;
  _allowed_statuses constant text[] := ARRAY['processing', 'forwarded', 'shipped', 'delivered', 'cancelled'];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _status IS NULL OR NOT (_status = ANY(_allowed_statuses)) THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT ol.*
  INTO _line
  FROM public.order_lines ol
  WHERE ol.id = _line_id
    AND (
      ol.vendor_id IN (SELECT v.id FROM public.vendors v WHERE v.auth_user_id = auth.uid())
      OR ol.vendor_id IN (SELECT public.current_user_vendor_account_ids())
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_line_not_found_or_forbidden';
  END IF;

  IF _quantity_shipped IS NOT NULL AND (_quantity_shipped < 0 OR _quantity_shipped > _line.quantity) THEN
    RAISE EXCEPTION 'invalid_quantity_shipped';
  END IF;

  UPDATE public.order_lines
  SET
    fulfillment_status = _status::public.fulfillment_status,
    qogita_order_status = CASE
      WHEN _status = 'forwarded' THEN 'forwarded'
      ELSE qogita_order_status
    END,
    quantity_shipped = COALESCE(_quantity_shipped, quantity_shipped),
    tracking_number = COALESCE(NULLIF(btrim(_tracking_number), ''), tracking_number),
    tracking_url = COALESCE(NULLIF(btrim(_tracking_url), ''), tracking_url),
    cancellation_reason = CASE
      WHEN _status = 'cancelled' THEN NULLIF(btrim(_cancellation_reason), '')
      ELSE cancellation_reason
    END,
    cancelled_at = CASE
      WHEN _status = 'cancelled' THEN now()
      ELSE cancelled_at
    END,
    refunded_amount_incl_vat = CASE
      WHEN _status = 'cancelled' THEN _refunded_amount_incl_vat
      ELSE refunded_amount_incl_vat
    END,
    updated_at = now()
  WHERE id = _line_id
  RETURNING * INTO _line;

  RETURN _line;
END;
$function$;
