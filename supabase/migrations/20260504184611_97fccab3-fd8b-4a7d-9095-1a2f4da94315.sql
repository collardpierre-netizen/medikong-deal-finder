CREATE OR REPLACE FUNCTION public.admin_purge_test_orders(
  _dry_run boolean DEFAULT true,
  _confirm_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_targets jsonb;
  v_order_ids uuid[];
  v_order_numbers text[];
  v_total numeric;
  v_lines_deleted int := 0;
  v_orders_deleted int := 0;
  v_expected_token constant text := 'PURGE TEST ORDERS';
BEGIN
  -- 1) Auth
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '42501';
  END IF;

  -- 2) Rôle admin requis
  SELECT public.has_role(v_uid, 'super_admin') OR public.has_role(v_uid, 'admin')
    INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  -- 3) Cibles
  SELECT
    array_agg(id),
    array_agg(order_number),
    coalesce(sum(total_incl_vat), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'order_number', order_number,
      'status', status,
      'total_incl_vat', total_incl_vat,
      'created_at', created_at
    ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_order_ids, v_order_numbers, v_total, v_targets
  FROM public.orders
  WHERE is_test = true;

  IF v_order_ids IS NULL OR cardinality(v_order_ids) = 0 THEN
    RETURN jsonb_build_object(
      'dry_run', _dry_run,
      'targets_count', 0,
      'targets', '[]'::jsonb,
      'orders_deleted', 0,
      'lines_deleted', 0
    );
  END IF;

  -- 4) Mode prévisualisation : on n'écrit rien, juste un audit léger
  IF _dry_run THEN
    INSERT INTO public.audit_logs (user_id, user_role, action, module, detail)
    VALUES (
      v_uid, 'admin', 'purge_test_orders.dry_run', 'orders',
      format('Prévisualisation : %s commande(s) test cibées (total TTC %s €)',
             cardinality(v_order_ids), v_total)
    );
    RETURN jsonb_build_object(
      'dry_run', true,
      'targets_count', cardinality(v_order_ids),
      'total_incl_vat', v_total,
      'targets', v_targets
    );
  END IF;

  -- 5) Jeton de confirmation requis pour purge réelle
  IF _confirm_token IS DISTINCT FROM v_expected_token THEN
    RAISE EXCEPTION 'Jeton de confirmation invalide. Attendu : %', v_expected_token
      USING ERRCODE = '22023';
  END IF;

  -- 6) Sécurité supplémentaire : on n'efface JAMAIS une commande non-test (impossible vu le filtre, mais on revérifie)
  PERFORM 1 FROM public.orders WHERE id = ANY(v_order_ids) AND is_test = false LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Anomalie : une commande non-test figure dans la sélection. Purge annulée.'
      USING ERRCODE = '22023';
  END IF;

  -- 7) Suppression
  WITH d AS (
    DELETE FROM public.order_lines WHERE order_id = ANY(v_order_ids) RETURNING 1
  )
  SELECT count(*) INTO v_lines_deleted FROM d;

  WITH d AS (
    DELETE FROM public.orders WHERE id = ANY(v_order_ids) AND is_test = true RETURNING 1
  )
  SELECT count(*) INTO v_orders_deleted FROM d;

  INSERT INTO public.audit_logs (user_id, user_role, action, module, detail)
  VALUES (
    v_uid, 'admin', 'purge_test_orders', 'orders',
    format('Purge confirmée : %s commande(s) test (%s ligne(s)) — %s',
           v_orders_deleted, v_lines_deleted,
           array_to_string(v_order_numbers, ', '))
  );

  RETURN jsonb_build_object(
    'dry_run', false,
    'orders_deleted', v_orders_deleted,
    'lines_deleted', v_lines_deleted,
    'order_numbers', to_jsonb(v_order_numbers)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_test_orders(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_purge_test_orders(boolean, text) TO authenticated;

-- Suppression de l'ancienne signature sans paramètres (force l'usage des garde-fous)
DROP FUNCTION IF EXISTS public.admin_purge_test_orders();