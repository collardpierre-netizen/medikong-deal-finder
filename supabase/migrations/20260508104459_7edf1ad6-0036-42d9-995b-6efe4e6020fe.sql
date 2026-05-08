CREATE OR REPLACE FUNCTION public.admin_category_mapping_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_mapped integer;
  v_per_mk jsonb;
  v_top_unmapped jsonb;
  v_proposals jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT count(*) FILTER (WHERE is_active),
         count(*) FILTER (WHERE is_active AND primary_category_id IS NOT NULL)
    INTO v_total, v_mapped
    FROM public.products;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.display_order)
    INTO v_per_mk
    FROM (
      SELECT c.id, c.slug, c.name_fr, c.name_nl, c.display_order,
             COALESCE((
               SELECT count(*) FROM public.products p
                WHERE p.is_active AND p.primary_category_id = c.id
             ), 0) AS products_mapped
        FROM public.categories c
       WHERE c.slug LIKE 'mk-%'
    ) t;

  SELECT jsonb_agg(row_to_json(t))
    INTO v_top_unmapped
    FROM (
      SELECT qogita_category_id, qogita_name, products_count
        FROM public.admin_unmapped_qogita_categories
       ORDER BY products_count DESC
       LIMIT 20
    ) t;

  SELECT jsonb_build_object(
    'pending', COALESCE(sum(CASE WHEN status='pending' THEN 1 ELSE 0 END), 0),
    'applied', COALESCE(sum(CASE WHEN status='applied' THEN 1 ELSE 0 END), 0),
    'rejected', COALESCE(sum(CASE WHEN status='rejected' THEN 1 ELSE 0 END), 0),
    'pending_products', COALESCE(sum(CASE WHEN status='pending' THEN products_count ELSE 0 END), 0),
    'applied_products', COALESCE(sum(CASE WHEN status='applied' THEN products_count ELSE 0 END), 0),
    'high_confidence_pending', COALESCE(sum(CASE WHEN status='pending' AND confidence >= 0.85 THEN 1 ELSE 0 END), 0),
    'high_confidence_pending_products', COALESCE(sum(CASE WHEN status='pending' AND confidence >= 0.85 THEN products_count ELSE 0 END), 0)
  ) INTO v_proposals
  FROM public.category_llm_mapping_proposals;

  RETURN jsonb_build_object(
    'total_products', v_total,
    'mapped_products', v_mapped,
    'unmapped_products', v_total - v_mapped,
    'percent_mapped', CASE WHEN v_total > 0 THEN round((v_mapped::numeric / v_total) * 100, 2) ELSE 0 END,
    'per_mk_category', COALESCE(v_per_mk, '[]'::jsonb),
    'top_unmapped_qogita', COALESCE(v_top_unmapped, '[]'::jsonb),
    'llm_proposals', v_proposals
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_category_mapping_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_category_mapping_dashboard() TO authenticated;