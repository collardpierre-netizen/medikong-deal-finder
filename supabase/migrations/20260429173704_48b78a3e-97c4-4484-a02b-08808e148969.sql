CREATE OR REPLACE FUNCTION public.merge_brands(_keep uuid, _drop uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep_name text;
  v_drop_name text;
  v_moved int := 0;
  v_actor uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(v_actor, 'super_admin'::app_role) OR public.has_role(v_actor, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden: admin required';
  END IF;
  IF _keep = _drop THEN
    RAISE EXCEPTION 'keep and drop must differ';
  END IF;

  SELECT name INTO v_keep_name FROM public.brands WHERE id = _keep;
  SELECT name INTO v_drop_name FROM public.brands WHERE id = _drop;
  IF v_keep_name IS NULL OR v_drop_name IS NULL THEN
    RAISE EXCEPTION 'brand not found';
  END IF;

  UPDATE public.products
     SET brand_id = _keep,
         brand_name = v_keep_name
   WHERE brand_id = _drop;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  UPDATE public.products
     SET brand_name = v_keep_name
   WHERE brand_id = _keep AND brand_name IS DISTINCT FROM v_keep_name;

  DELETE FROM public.brands WHERE id = _drop;

  INSERT INTO public.audit_logs(actor_id, module, action, target_type, target_id, payload)
  VALUES (
    v_actor, 'brands', 'brand_merge', 'brand', _keep,
    jsonb_build_object(
      'kept_id', _keep, 'kept_name', v_keep_name,
      'dropped_id', _drop, 'dropped_name', v_drop_name,
      'products_reassigned', v_moved
    )
  );

  RETURN jsonb_build_object('kept_id', _keep, 'dropped_id', _drop, 'products_reassigned', v_moved);
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_merge_brand_duplicates(_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_groups int := 0;
  v_merges int := 0;
  v_products int := 0;
  rec record;
  i int;
  v_res jsonb;
  v_log jsonb := '[]'::jsonb;
BEGIN
  IF NOT (public.has_role(v_actor, 'super_admin'::app_role) OR public.has_role(v_actor, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden: admin required';
  END IF;

  FOR rec IN SELECT * FROM public.find_brand_duplicates() LOOP
    v_groups := v_groups + 1;
    FOR i IN 2 .. array_length(rec.brand_ids, 1) LOOP
      IF _dry_run THEN
        v_log := v_log || jsonb_build_object(
          'keep', rec.brand_names[1], 'drop', rec.brand_names[i],
          'norm_key', rec.norm_key, 'products', rec.product_counts[i]
        );
      ELSE
        v_res := public.merge_brands(rec.brand_ids[1], rec.brand_ids[i]);
        v_merges := v_merges + 1;
        v_products := v_products + coalesce((v_res->>'products_reassigned')::int, 0);
        v_log := v_log || (v_res || jsonb_build_object(
          'keep_name', rec.brand_names[1], 'drop_name', rec.brand_names[i]
        ));
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', _dry_run,
    'groups_found', v_groups,
    'merges_executed', v_merges,
    'products_reassigned', v_products,
    'details', v_log
  );
END;
$$;