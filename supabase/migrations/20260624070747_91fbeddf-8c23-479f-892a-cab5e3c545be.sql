
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS was_forecast boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forecast_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS forecast_converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS forecast_snapshot jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_was_forecast
  ON public.orders(was_forecast) WHERE was_forecast = true;

UPDATE public.orders o
SET was_forecast = true,
    forecast_created_at = COALESCE(forecast_created_at, created_at),
    forecast_snapshot = COALESCE(forecast_snapshot, jsonb_build_object(
      'total_incl_vat', o.total_incl_vat,
      'subtotal_excl_vat', o.subtotal_excl_vat,
      'vat_amount', o.vat_amount,
      'customer_id', o.customer_id,
      'created_at', o.created_at,
      'backfilled', true
    ))
WHERE o.is_forecast = true AND o.was_forecast = false;

CREATE OR REPLACE FUNCTION public.orders_forecast_history_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.was_forecast = true AND NEW.was_forecast = false THEN
    NEW.was_forecast := true;
  END IF;

  IF NEW.is_forecast = true AND NEW.was_forecast = false THEN
    NEW.was_forecast := true;
    NEW.forecast_created_at := COALESCE(NEW.forecast_created_at, now());
  END IF;

  IF NEW.is_forecast = true AND NEW.forecast_snapshot IS NULL THEN
    SELECT jsonb_build_object(
      'total_incl_vat', NEW.total_incl_vat,
      'subtotal_excl_vat', NEW.subtotal_excl_vat,
      'vat_amount', NEW.vat_amount,
      'customer_id', NEW.customer_id,
      'created_at', COALESCE(NEW.created_at, now()),
      'lines', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'product_id', ol.product_id,
          'offer_id', ol.offer_id,
          'vendor_id', ol.vendor_id,
          'quantity', ol.quantity,
          'unit_price_incl_vat', ol.unit_price_incl_vat,
          'line_total_incl_vat', ol.line_total_incl_vat
        ) ORDER BY ol.id)
        FROM public.order_lines ol
        WHERE ol.order_id = NEW.id
      ), '[]'::jsonb)
    )
    INTO v_snapshot;
    NEW.forecast_snapshot := v_snapshot;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_forecast_history ON public.orders;
CREATE TRIGGER trg_orders_forecast_history
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.orders_forecast_history_trg();

CREATE OR REPLACE FUNCTION public.admin_convert_forecast_to_real(
  _order_id uuid,
  _notes text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;
  IF v_order.is_forecast IS NOT TRUE THEN
    RAISE EXCEPTION 'not_a_forecast_order';
  END IF;

  UPDATE public.orders
  SET is_forecast = false,
      forecast_converted_at = now(),
      status = 'confirmed'::order_status,
      admin_notes = COALESCE(admin_notes, '') ||
        CASE WHEN admin_notes IS NULL OR admin_notes = '' THEN '' ELSE E'\n' END
        || '[Conversion prévisionnel -> réel le ' || to_char(now(),'YYYY-MM-DD HH24:MI') || ']'
        || COALESCE(' ' || _notes, ''),
      updated_at = now()
  WHERE id = _order_id
  RETURNING * INTO v_order;

  INSERT INTO public.audit_logs (action, resource_type, resource_id, user_id, metadata)
  VALUES (
    'forecast_order_converted',
    'order',
    _order_id,
    auth.uid(),
    jsonb_build_object('notes', _notes, 'order_number', v_order.order_number)
  );

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_convert_forecast_to_real(uuid, text) TO authenticated;

CREATE OR REPLACE VIEW public.admin_orders_with_forecast_v
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.order_number,
  o.customer_id,
  o.status,
  o.created_at,
  o.updated_at,
  o.total_incl_vat,
  o.subtotal_excl_vat,
  o.vat_amount,
  o.is_forecast,
  o.was_forecast,
  o.forecast_created_at,
  o.forecast_converted_at,
  o.forecast_snapshot,
  CASE
    WHEN o.was_forecast AND o.is_forecast THEN 'active'
    WHEN o.was_forecast AND o.forecast_converted_at IS NOT NULL THEN 'converted'
    WHEN o.was_forecast AND o.status::text IN ('cancelled','error') THEN 'cancelled'
    WHEN o.was_forecast THEN 'modified'
    ELSE NULL
  END AS forecast_status,
  COALESCE((o.forecast_snapshot->>'total_incl_vat')::numeric, 0) AS forecast_total_incl_vat,
  CASE
    WHEN o.is_forecast THEN COALESCE((o.forecast_snapshot->>'total_incl_vat')::numeric, o.total_incl_vat)
    ELSE o.total_incl_vat
  END AS effective_total_incl_vat
FROM public.orders o
WHERE public.is_admin(auth.uid());

GRANT SELECT ON public.admin_orders_with_forecast_v TO authenticated;
