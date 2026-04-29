CREATE OR REPLACE FUNCTION public.resolve_product_manufacturers(
  _dry_run boolean DEFAULT false,
  _limit integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_log_id uuid;
  v_via_brand integer := 0;
  v_via_supplier integer := 0;
  v_via_dict integer := 0;
  v_total_before integer;
  v_total_after integer;
BEGIN
  IF v_user IS NULL OR NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE='42501';
  END IF;

  SELECT COUNT(*) INTO v_total_before
  FROM public.products
  WHERE is_active = true AND manufacturer_id IS NULL
    AND COALESCE(manual_mapping_validated, false) = false;

  INSERT INTO public.sync_logs (sync_type, status, progress_message)
  VALUES ('manual'::sync_type_enum, 'running'::sync_log_status,
          'resolve_product_manufacturers ' || CASE WHEN _dry_run THEN '(dry-run)' ELSE '' END)
  RETURNING id INTO v_log_id;

  WITH candidates AS (
    SELECT p.id AS product_id, b.manufacturer_id AS new_mfr
    FROM public.products p
    JOIN public.brands b ON b.id = p.brand_id
    WHERE p.is_active = true
      AND p.manufacturer_id IS NULL
      AND COALESCE(p.manual_mapping_validated, false) = false
      AND b.manufacturer_id IS NOT NULL
    LIMIT COALESCE(_limit, 1000000)
  ),
  upd AS (
    UPDATE public.products p
    SET manufacturer_id = c.new_mfr, updated_at = now()
    FROM candidates c
    WHERE p.id = c.product_id AND NOT _dry_run
    RETURNING 1
  )
  SELECT CASE WHEN _dry_run THEN (SELECT COUNT(*) FROM candidates)
              ELSE (SELECT COUNT(*) FROM upd) END
  INTO v_via_brand;

  WITH candidates AS (
    SELECT DISTINCT ON (mp.product_id) mp.product_id, m.id AS new_mfr
    FROM public.market_prices mp
    JOIN public.products p ON p.id = mp.product_id
    JOIN public.manufacturers m
      ON m.norm_key = public.normalize_brand_name(mp.supplier_name)
      OR public.normalize_brand_name(mp.supplier_name) = ANY(
           SELECT public.normalize_brand_name(unnest(COALESCE(m.aliases, '{}'::text[])))
         )
    WHERE mp.is_matched = true
      AND mp.supplier_name IS NOT NULL AND mp.supplier_name <> ''
      AND p.is_active = true
      AND p.manufacturer_id IS NULL
      AND COALESCE(p.manual_mapping_validated, false) = false
    ORDER BY mp.product_id, mp.imported_at DESC
    LIMIT COALESCE(_limit, 1000000)
  ),
  upd AS (
    UPDATE public.products p
    SET manufacturer_id = c.new_mfr, updated_at = now()
    FROM candidates c
    WHERE p.id = c.product_id AND NOT _dry_run
    RETURNING 1
  )
  SELECT CASE WHEN _dry_run THEN (SELECT COUNT(*) FROM candidates)
              ELSE (SELECT COUNT(*) FROM upd) END
  INTO v_via_supplier;

  WITH candidates AS (
    SELECT DISTINCT ON (p.id) p.id AS product_id, m.id AS new_mfr
    FROM public.products p
    LEFT JOIN public.brands b ON b.id = p.brand_id
    JOIN public.manufacturers m
      ON m.norm_key = COALESCE(b.norm_key, public.normalize_brand_name(p.brand_name))
      OR COALESCE(b.norm_key, public.normalize_brand_name(p.brand_name)) = ANY(
           SELECT public.normalize_brand_name(unnest(COALESCE(m.aliases, '{}'::text[])))
         )
    WHERE p.is_active = true
      AND p.manufacturer_id IS NULL
      AND COALESCE(p.manual_mapping_validated, false) = false
      AND (b.norm_key IS NOT NULL OR (p.brand_name IS NOT NULL AND p.brand_name <> ''))
    LIMIT COALESCE(_limit, 1000000)
  ),
  upd AS (
    UPDATE public.products p
    SET manufacturer_id = c.new_mfr, updated_at = now()
    FROM candidates c
    WHERE p.id = c.product_id AND NOT _dry_run
    RETURNING 1
  )
  SELECT CASE WHEN _dry_run THEN (SELECT COUNT(*) FROM candidates)
              ELSE (SELECT COUNT(*) FROM upd) END
  INTO v_via_dict;

  SELECT COUNT(*) INTO v_total_after
  FROM public.products
  WHERE is_active = true AND manufacturer_id IS NULL
    AND COALESCE(manual_mapping_validated, false) = false;

  IF NOT _dry_run THEN
    PERFORM public.update_manufacturer_product_counts();
  END IF;

  UPDATE public.sync_logs
  SET status = 'completed'::sync_log_status,
      completed_at = now(),
      progress_total = COALESCE(v_via_brand,0) + COALESCE(v_via_supplier,0) + COALESCE(v_via_dict,0),
      progress_current = COALESCE(v_via_brand,0) + COALESCE(v_via_supplier,0) + COALESCE(v_via_dict,0),
      stats = jsonb_build_object(
        'dry_run', _dry_run,
        'via_brand_manufacturer', v_via_brand,
        'via_supplier_name', v_via_supplier,
        'via_brand_dictionary', v_via_dict,
        'null_before', v_total_before,
        'null_after', v_total_after,
        'resolved_total', v_total_before - v_total_after
      )
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'dry_run', _dry_run,
    'via_brand_manufacturer', v_via_brand,
    'via_supplier_name', v_via_supplier,
    'via_brand_dictionary', v_via_dict,
    'null_before', v_total_before,
    'null_after', v_total_after,
    'resolved_total', v_total_before - v_total_after,
    'log_id', v_log_id
  );
END;
$$;