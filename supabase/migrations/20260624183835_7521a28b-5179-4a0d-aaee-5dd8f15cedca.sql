
CREATE OR REPLACE FUNCTION public.admin_hard_delete_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(v_uid, 'super_admin') OR public.has_role(v_uid, 'admin')) THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status NOT IN ('cancelled','draft') AND COALESCE(v_order.is_test, false) = false THEN
    RAISE EXCEPTION 'Suppression définitive réservée aux commandes annulées, brouillons ou test (statut actuel : %)', v_order.status
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.audit_logs (user_id, user_role, action, module, detail)
  VALUES (
    v_uid, 'admin', 'hard_delete_order', 'orders',
    format('Suppression définitive commande %s (statut=%s, total=%s €)',
           v_order.order_number, v_order.status, v_order.total_incl_vat)
  );

  DELETE FROM public.orders WHERE id = _order_id;

  RETURN jsonb_build_object(
    'deleted', true,
    'order_number', v_order.order_number,
    'status', v_order.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_hard_delete_order(uuid) TO authenticated;
