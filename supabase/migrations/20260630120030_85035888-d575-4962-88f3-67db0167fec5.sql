
CREATE OR REPLACE FUNCTION public.admin_get_order_split_summary(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_expected jsonb;
  v_actual jsonb;
  v_expected_ids uuid[];
  v_actual_ids uuid[];
  v_missing uuid[];
  v_extra uuid[];
  v_first_created timestamptz;
  v_last_created timestamptz;
  v_last_updated timestamptz;
  v_order record;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id, order_number, status, payment_status, is_forecast, created_at, updated_at
    INTO v_order
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT vendor_id) FILTER (WHERE vendor_id IS NOT NULL), '{}')
    INTO v_expected_ids
  FROM public.order_lines
  WHERE order_id = _order_id;

  SELECT COALESCE(array_agg(DISTINCT vendor_id) FILTER (WHERE vendor_id IS NOT NULL), '{}'),
         min(created_at), max(created_at), max(updated_at)
    INTO v_actual_ids, v_first_created, v_last_created, v_last_updated
  FROM public.sub_orders
  WHERE order_id = _order_id;

  v_missing := ARRAY(SELECT unnest(v_expected_ids) EXCEPT SELECT unnest(v_actual_ids));
  v_extra   := ARRAY(SELECT unnest(v_actual_ids)   EXCEPT SELECT unnest(v_expected_ids));

  SELECT jsonb_agg(jsonb_build_object(
    'vendor_id', vendor_id,
    'vendor_label', COALESCE(v.company_name, v.name, 'Fournisseur'),
    'line_count', line_count,
    'subtotal_incl_vat', subtotal_incl_vat
  ) ORDER BY v.company_name NULLS LAST)
    INTO v_expected
  FROM (
    SELECT vendor_id,
           COUNT(*) AS line_count,
           ROUND(SUM(COALESCE(quantity,0) * COALESCE(unit_price_excl_vat,0) * (1 + COALESCE(vat_rate,0)/100.0))::numeric, 2) AS subtotal_incl_vat
    FROM public.order_lines
    WHERE order_id = _order_id AND vendor_id IS NOT NULL
    GROUP BY vendor_id
  ) ol
  LEFT JOIN public.vendors v ON v.id = ol.vendor_id;

  SELECT jsonb_agg(jsonb_build_object(
    'sub_order_id', so.id,
    'vendor_id', so.vendor_id,
    'vendor_label', COALESCE(v.company_name, v.name, 'Fournisseur'),
    'status', so.status,
    'payment_status', so.payment_status,
    'subtotal_incl_vat', so.subtotal_incl_vat,
    'commission_amount_override', so.commission_amount_override,
    'commission_rate_override', so.commission_rate_override,
    'created_at', so.created_at,
    'updated_at', so.updated_at,
    'vendor_first_viewed_at', so.vendor_first_viewed_at,
    'vendor_confirmed_at', so.vendor_confirmed_at,
    'shipped_at', so.shipped_at
  ) ORDER BY so.created_at)
    INTO v_actual
  FROM public.sub_orders so
  LEFT JOIN public.vendors v ON v.id = so.vendor_id
  WHERE so.order_id = _order_id;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'payment_status', v_order.payment_status,
      'is_forecast', v_order.is_forecast,
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at
    ),
    'expected_vendor_count', COALESCE(array_length(v_expected_ids, 1), 0),
    'actual_sub_order_count', COALESCE(array_length(v_actual_ids, 1), 0),
    'missing_vendor_ids', COALESCE(v_missing, '{}'),
    'extra_vendor_ids', COALESCE(v_extra, '{}'),
    'first_sub_order_at', v_first_created,
    'last_sub_order_at', v_last_created,
    'last_sub_order_updated_at', v_last_updated,
    'overall_status', CASE
      WHEN COALESCE(array_length(v_expected_ids, 1), 0) = 0 THEN 'no_vendor_lines'
      WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'missing'
      WHEN COALESCE(array_length(v_extra, 1), 0) > 0 THEN 'extra'
      ELSE 'ok'
    END,
    'expected', COALESCE(v_expected, '[]'::jsonb),
    'sub_orders', COALESCE(v_actual, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_order_split_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_order_split_summary(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.admin_reprocess_order_fanout(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_dispatched int := 0;
  v_admin_id uuid;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id) THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  -- Re-run idempotent fan-out. Each row returned = one vendor processed (existing or newly created).
  SELECT COUNT(*) INTO v_dispatched
  FROM public.fanout_order_to_vendors(_order_id);

  v_admin_id := auth.uid();
  BEGIN
    INSERT INTO public.admin_audit_log (actor_user_id, action, target_type, target_id, metadata)
    VALUES (v_admin_id, 'reprocess_order_fanout', 'order', _order_id,
            jsonb_build_object('dispatched', v_dispatched));
  EXCEPTION WHEN OTHERS THEN
    -- audit log is best-effort
    NULL;
  END;

  RETURN public.admin_get_order_split_summary(_order_id) ||
         jsonb_build_object('reprocessed', true, 'dispatched_rows', v_dispatched);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reprocess_order_fanout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reprocess_order_fanout(uuid) TO authenticated, service_role;
