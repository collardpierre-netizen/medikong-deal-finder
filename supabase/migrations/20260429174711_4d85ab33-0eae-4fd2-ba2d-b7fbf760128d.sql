-- 1. Add manual validation flag on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS manual_mapping_validated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_mapping_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_mapping_validated_by uuid;

CREATE INDEX IF NOT EXISTS idx_products_manual_mapping_validated
  ON public.products (source, manual_mapping_validated)
  WHERE is_active = true;

-- 2. Overview per source
CREATE OR REPLACE FUNCTION public.get_source_mapping_overview()
RETURNS TABLE (
  source text,
  total_products bigint,
  without_brand bigint,
  without_category bigint,
  without_manufacturer bigint,
  manually_validated bigint,
  unresolved_brand_values bigint,
  unresolved_category_values bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(p.source::text, 'unknown') AS source,
    COUNT(*) AS total_products,
    COUNT(*) FILTER (WHERE p.brand_id IS NULL) AS without_brand,
    COUNT(*) FILTER (WHERE p.category_id IS NULL) AS without_category,
    COUNT(*) FILTER (WHERE p.manufacturer_id IS NULL) AS without_manufacturer,
    COUNT(*) FILTER (WHERE p.manual_mapping_validated) AS manually_validated,
    COUNT(DISTINCT p.brand_name) FILTER (WHERE p.brand_id IS NULL AND p.brand_name IS NOT NULL AND p.brand_name <> '') AS unresolved_brand_values,
    COUNT(DISTINCT p.category_name) FILTER (WHERE p.category_id IS NULL AND p.category_name IS NOT NULL AND p.category_name <> '') AS unresolved_category_values
  FROM public.products p
  WHERE p.is_active = true
  GROUP BY COALESCE(p.source::text, 'unknown')
  ORDER BY total_products DESC;
$$;

REVOKE ALL ON FUNCTION public.get_source_mapping_overview() FROM public;
GRANT EXECUTE ON FUNCTION public.get_source_mapping_overview() TO authenticated;

-- 3. Unresolved raw values (brand_name / category_name) for a given source
CREATE OR REPLACE FUNCTION public.get_source_mapping_issues(
  _source text,
  _kind text DEFAULT 'brand', -- 'brand' or 'category'
  _limit integer DEFAULT 100
)
RETURNS TABLE (
  raw_value text,
  product_count bigint,
  example_product_id uuid,
  example_product_name text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;

  IF _kind = 'brand' THEN
    RETURN QUERY
    SELECT
      p.brand_name AS raw_value,
      COUNT(*)::bigint AS product_count,
      (array_agg(p.id ORDER BY p.name))[1] AS example_product_id,
      (array_agg(p.name ORDER BY p.name))[1] AS example_product_name
    FROM public.products p
    WHERE p.is_active = true
      AND p.brand_id IS NULL
      AND p.brand_name IS NOT NULL
      AND p.brand_name <> ''
      AND (_source IS NULL OR _source = '' OR COALESCE(p.source::text,'unknown') = _source)
    GROUP BY p.brand_name
    ORDER BY product_count DESC
    LIMIT GREATEST(_limit, 1);
  ELSIF _kind = 'category' THEN
    RETURN QUERY
    SELECT
      p.category_name AS raw_value,
      COUNT(*)::bigint AS product_count,
      (array_agg(p.id ORDER BY p.name))[1] AS example_product_id,
      (array_agg(p.name ORDER BY p.name))[1] AS example_product_name
    FROM public.products p
    WHERE p.is_active = true
      AND p.category_id IS NULL
      AND p.category_name IS NOT NULL
      AND p.category_name <> ''
      AND (_source IS NULL OR _source = '' OR COALESCE(p.source::text,'unknown') = _source)
    GROUP BY p.category_name
    ORDER BY product_count DESC
    LIMIT GREATEST(_limit, 1);
  ELSE
    RAISE EXCEPTION 'Kind invalide: % (attendu brand|category)', _kind USING ERRCODE='22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_source_mapping_issues(text,text,integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_source_mapping_issues(text,text,integer) TO authenticated;

-- 4. Drill-down: products of a source with filter
CREATE OR REPLACE FUNCTION public.get_source_mapping_products(
  _source text,
  _filter text DEFAULT 'all', -- all | no_brand | no_category | no_manufacturer | validated | unvalidated
  _search text DEFAULT NULL,
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_image text,
  source text,
  brand_id uuid,
  brand_name_raw text,
  brand_name_resolved text,
  category_id uuid,
  category_name_raw text,
  category_name_resolved text,
  manufacturer_id uuid,
  manufacturer_name text,
  manual_mapping_validated boolean,
  manual_mapping_validated_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.*
    FROM public.products p
    WHERE p.is_active = true
      AND (_source IS NULL OR _source = '' OR COALESCE(p.source::text,'unknown') = _source)
      AND (
        _filter = 'all'
        OR (_filter = 'no_brand' AND p.brand_id IS NULL)
        OR (_filter = 'no_category' AND p.category_id IS NULL)
        OR (_filter = 'no_manufacturer' AND p.manufacturer_id IS NULL)
        OR (_filter = 'validated' AND p.manual_mapping_validated = true)
        OR (_filter = 'unvalidated' AND p.manual_mapping_validated = false)
      )
      AND (
        _search IS NULL OR _search = ''
        OR p.name ILIKE '%' || _search || '%'
        OR p.brand_name ILIKE '%' || _search || '%'
        OR p.category_name ILIKE '%' || _search || '%'
        OR p.gtin = _search
        OR p.cnk_code = _search
      )
  ),
  cnt AS (SELECT COUNT(*)::bigint AS total FROM base)
  SELECT
    b.id,
    b.name,
    COALESCE(b.image_url, (b.image_urls)[1]),
    COALESCE(b.source::text,'unknown'),
    b.brand_id,
    b.brand_name,
    br.name,
    b.category_id,
    b.category_name,
    c.name,
    b.manufacturer_id,
    m.name,
    b.manual_mapping_validated,
    b.manual_mapping_validated_at,
    (SELECT total FROM cnt)
  FROM base b
  LEFT JOIN public.brands br ON br.id = b.brand_id
  LEFT JOIN public.categories c ON c.id = b.category_id
  LEFT JOIN public.manufacturers m ON m.id = b.manufacturer_id
  ORDER BY b.manual_mapping_validated ASC, b.name
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_source_mapping_products(text,text,text,integer,integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_source_mapping_products(text,text,text,integer,integer) TO authenticated;

-- 5. Admin: apply manual mapping to one or many products
CREATE OR REPLACE FUNCTION public.admin_apply_product_mapping(
  _product_ids uuid[],
  _brand_id uuid DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _manufacturer_id uuid DEFAULT NULL,
  _mark_validated boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_updated integer := 0;
  v_brand_name text;
  v_category_name text;
  v_apply_brand boolean := _brand_id IS NOT NULL;
  v_apply_cat boolean := _category_id IS NOT NULL;
  v_apply_mfr boolean := _manufacturer_id IS NOT NULL;
BEGIN
  IF v_user IS NULL OR NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE='42501';
  END IF;

  IF _product_ids IS NULL OR array_length(_product_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('updated', 0);
  END IF;

  IF v_apply_brand THEN
    SELECT name INTO v_brand_name FROM public.brands WHERE id = _brand_id;
    IF v_brand_name IS NULL THEN
      RAISE EXCEPTION 'Marque introuvable' USING ERRCODE='22023';
    END IF;
  END IF;

  IF v_apply_cat THEN
    SELECT name INTO v_category_name FROM public.categories WHERE id = _category_id;
    IF v_category_name IS NULL THEN
      RAISE EXCEPTION 'Catégorie introuvable' USING ERRCODE='22023';
    END IF;
  END IF;

  IF v_apply_mfr THEN
    PERFORM 1 FROM public.manufacturers WHERE id = _manufacturer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fabricant introuvable' USING ERRCODE='22023';
    END IF;
  END IF;

  UPDATE public.products p
  SET
    brand_id        = CASE WHEN v_apply_brand THEN _brand_id ELSE p.brand_id END,
    brand_name      = CASE WHEN v_apply_brand THEN v_brand_name ELSE p.brand_name END,
    category_id     = CASE WHEN v_apply_cat THEN _category_id ELSE p.category_id END,
    category_name   = CASE WHEN v_apply_cat THEN v_category_name ELSE p.category_name END,
    manufacturer_id = CASE WHEN v_apply_mfr THEN _manufacturer_id ELSE p.manufacturer_id END,
    manual_mapping_validated    = CASE WHEN _mark_validated THEN true ELSE p.manual_mapping_validated END,
    manual_mapping_validated_at = CASE WHEN _mark_validated THEN now() ELSE p.manual_mapping_validated_at END,
    manual_mapping_validated_by = CASE WHEN _mark_validated THEN v_user ELSE p.manual_mapping_validated_by END,
    updated_at = now()
  WHERE p.id = ANY(_product_ids);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Audit
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
    SELECT v_user,
           'product_mapping_applied',
           'product',
           pid,
           jsonb_build_object(
             'brand_id', _brand_id,
             'category_id', _category_id,
             'manufacturer_id', _manufacturer_id,
             'mark_validated', _mark_validated
           )
    FROM unnest(_product_ids) pid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN jsonb_build_object('updated', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_apply_product_mapping(uuid[],uuid,uuid,uuid,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_apply_product_mapping(uuid[],uuid,uuid,uuid,boolean) TO authenticated;

-- 6. Recent import runs (aggregated across the 3 log tables)
CREATE OR REPLACE FUNCTION public.get_recent_import_runs(_limit integer DEFAULT 50)
RETURNS TABLE (
  source text,
  run_type text,
  status text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms bigint,
  rows_processed bigint,
  rows_created bigint,
  rows_updated bigint,
  rows_failed bigint,
  message text,
  metadata jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  (
    SELECT
      'qogita'::text AS source,
      ('qogita_' || sl.sync_type::text)::text AS run_type,
      sl.status::text,
      sl.started_at,
      sl.completed_at,
      EXTRACT(EPOCH FROM (COALESCE(sl.completed_at, now()) - sl.started_at))::bigint * 1000 AS duration_ms,
      sl.progress_total::bigint AS rows_processed,
      COALESCE((sl.stats->>'created')::bigint, 0) AS rows_created,
      COALESCE((sl.stats->>'updated')::bigint, 0) AS rows_updated,
      COALESCE((sl.stats->>'errors')::bigint, 0) AS rows_failed,
      sl.error_message AS message,
      sl.stats AS metadata
    FROM public.sync_logs sl
    ORDER BY sl.started_at DESC
    LIMIT GREATEST(_limit,1)
  )
  UNION ALL
  (
    SELECT
      'qogita'::text,
      ('qogita_resync_' || qrl.mode::text)::text,
      qrl.status::text,
      qrl.started_at,
      qrl.completed_at,
      qrl.duration_ms::bigint,
      qrl.products_processed::bigint,
      qrl.offers_created::bigint,
      qrl.offers_updated::bigint,
      qrl.total_errors::bigint,
      qrl.error_message,
      qrl.metadata
    FROM public.qogita_resync_logs qrl
    ORDER BY qrl.started_at DESC
    LIMIT GREATEST(_limit,1)
  )
  UNION ALL
  (
    SELECT
      ('external:' || COALESCE(ev.name, 'inconnu'))::text,
      ('external_offers_' || eil.source)::text,
      CASE WHEN eil.rows_failed > 0 THEN 'partial' ELSE 'completed' END,
      eil.created_at,
      eil.created_at,
      0::bigint,
      eil.rows_received::bigint,
      eil.rows_upserted::bigint,
      eil.rows_matched::bigint,
      eil.rows_failed::bigint,
      NULL::text,
      jsonb_build_object('unmatched_gtins', eil.unmatched_gtins, 'errors', eil.errors)
    FROM public.external_offers_import_logs eil
    LEFT JOIN public.external_vendors ev ON ev.id = eil.external_vendor_id
    ORDER BY eil.created_at DESC
    LIMIT GREATEST(_limit,1)
  )
  ORDER BY started_at DESC
  LIMIT GREATEST(_limit,1);
END;
$$;

REVOKE ALL ON FUNCTION public.get_recent_import_runs(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_recent_import_runs(integer) TO authenticated;