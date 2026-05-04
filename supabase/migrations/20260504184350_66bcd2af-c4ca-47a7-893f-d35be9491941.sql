CREATE OR REPLACE FUNCTION public.admin_purge_test_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_order_ids uuid[];
  v_order_numbers text[];
  v_lines_deleted int := 0;
  v_orders_deleted int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '42501';
  END IF;

  SELECT public.has_role(v_uid, 'super_admin') OR public.has_role(v_uid, 'admin')
    INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(id), array_agg(order_number)
    INTO v_order_ids, v_order_numbers
  FROM public.orders
  WHERE is_test = true;

  IF v_order_ids IS NULL OR cardinality(v_order_ids) = 0 THEN
    RETURN jsonb_build_object('orders_deleted', 0, 'lines_deleted', 0, 'order_numbers', '[]'::jsonb);
  END IF;

  WITH d AS (
    DELETE FROM public.order_lines WHERE order_id = ANY(v_order_ids) RETURNING 1
  )
  SELECT count(*) INTO v_lines_deleted FROM d;

  WITH d AS (
    DELETE FROM public.orders WHERE id = ANY(v_order_ids) RETURNING 1
  )
  SELECT count(*) INTO v_orders_deleted FROM d;

  INSERT INTO public.audit_logs (user_id, user_role, action, module, detail)
  VALUES (
    v_uid,
    'admin',
    'purge_test_orders',
    'orders',
    format('Purge de %s commande(s) test (%s ligne(s)) — %s',
           v_orders_deleted, v_lines_deleted,
           array_to_string(v_order_numbers, ', '))
  );

  RETURN jsonb_build_object(
    'orders_deleted', v_orders_deleted,
    'lines_deleted', v_lines_deleted,
    'order_numbers', to_jsonb(v_order_numbers)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_test_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_purge_test_orders() TO authenticated;