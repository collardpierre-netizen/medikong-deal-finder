CREATE OR REPLACE FUNCTION public.match_products_by_names_batch(_queries jsonb, _threshold double precision DEFAULT 0.5)
 RETURNS TABLE(idx integer, product_id uuid, similarity double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  PERFORM set_limit(GREATEST(0.2::real, LEAST(_threshold::real, 0.4::real)));

  RETURN QUERY
  WITH q AS (
    SELECT
      (e->>'idx')::int AS idx,
      e->>'name' AS name,
      NULLIF(e->>'brand', '') AS brand
    FROM jsonb_array_elements(_queries) e
    WHERE COALESCE(e->>'name','') <> ''
  )
  SELECT q.idx,
         m.id AS product_id,
         m.sim AS similarity
  FROM q
  LEFT JOIN LATERAL (
    SELECT p.id,
           GREATEST(
             similarity(COALESCE(p.name,''),    q.name),
             similarity(COALESCE(p.name_fr,''), q.name),
             similarity(COALESCE(p.name_en,''), q.name)
           )::float AS sim
    FROM public.products p
    WHERE p.is_active = true
      AND (
            p.name    % q.name
         OR p.name_fr % q.name
         OR p.name_en % q.name
      )
      AND (q.brand IS NULL OR p.brand_name ILIKE '%' || q.brand || '%')
    ORDER BY GREATEST(
               similarity(COALESCE(p.name,''),    q.name),
               similarity(COALESCE(p.name_fr,''), q.name),
               similarity(COALESCE(p.name_en,''), q.name)
             ) DESC
    LIMIT 1
  ) m ON m.sim >= _threshold;
END;
$function$;