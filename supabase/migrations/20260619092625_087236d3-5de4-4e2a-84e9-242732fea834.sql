
CREATE OR REPLACE FUNCTION public.vendor_update_order_line_status(
  _line_id uuid,
  _status text,
  _quantity_shipped integer DEFAULT NULL::integer,
  _tracking_number text DEFAULT NULL::text,
  _tracking_url text DEFAULT NULL::text,
  _cancellation_reason text DEFAULT NULL::text,
  _refunded_amount_incl_vat numeric DEFAULT NULL::numeric
)
RETURNS public.order_lines
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _line public.order_lines;
  _allowed_statuses constant text[] := ARRAY['processing', 'forwarded', 'shipped', 'delivered', 'cancelled'];
  _status_rank constant jsonb := '{"pending":0,"processing":1,"forwarded":1,"shipped":2,"delivered":3,"cancelled":-1}'::jsonb;
  _is_revert boolean := false;
  _new_qty_shipped integer;
  _new_tracking_number text;
  _new_tracking_url text;
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

  -- Détecter un revert (statut cible < statut courant dans la chaîne workflow)
  IF _status <> 'cancelled'
     AND (_status_rank->>_status)::int < COALESCE((_status_rank->>_line.fulfillment_status::text)::int, 0)
  THEN
    _is_revert := true;
  END IF;

  -- Calcul des nouveaux champs d'expédition
  IF _is_revert AND _status IN ('processing', 'pending') THEN
    -- Revert vers préparation : on efface tout ce qui concerne l'expédition
    _new_qty_shipped := 0;
    _new_tracking_number := NULL;
    _new_tracking_url := NULL;
  ELSE
    _new_qty_shipped := COALESCE(_quantity_shipped, _line.quantity_shipped);
    _new_tracking_number := COALESCE(NULLIF(btrim(_tracking_number), ''), _line.tracking_number);
    _new_tracking_url := COALESCE(NULLIF(btrim(_tracking_url), ''), _line.tracking_url);
  END IF;

  UPDATE public.order_lines
  SET
    fulfillment_status = _status::public.fulfillment_status,
    qogita_order_status = CASE
      WHEN _status = 'forwarded' THEN 'forwarded'
      ELSE qogita_order_status
    END,
    quantity_shipped = _new_qty_shipped,
    tracking_number = _new_tracking_number,
    tracking_url = _new_tracking_url,
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

-- Réparation ponctuelle : la ligne de MK-2026-24395 qui est restée bloquée
UPDATE public.order_lines
SET
  quantity_shipped = 0,
  tracking_number = NULL,
  tracking_url = NULL,
  updated_at = now()
WHERE id = 'b1e6e03a-b68b-4951-b83c-ae7aadec2cc9'
  AND fulfillment_status = 'processing';
