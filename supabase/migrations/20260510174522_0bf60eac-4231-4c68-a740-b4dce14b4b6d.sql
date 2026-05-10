CREATE OR REPLACE FUNCTION public.match_products_by_names_batch(
  _queries jsonb,
  _threshold double precision DEFAULT 0.7
)
RETURNS TABLE(idx int, product_id uuid, similarity double precision)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  with q as (
    select
      (e->>'idx')::int as idx,
      e->>'name' as name,
      e->>'brand' as brand
    from jsonb_array_elements(_queries) e
    where coalesce(e->>'name','') <> ''
  )
  select q.idx,
         m.id as product_id,
         m.sim as similarity
  from q
  left join lateral (
    select p.id,
           greatest(
             similarity(coalesce(p.name,''), q.name),
             similarity(coalesce(p.name_fr,''), q.name),
             similarity(coalesce(p.name_en,''), q.name)
           )::float as sim
    from public.products p
    left join public.brands b on b.id = p.brand_id
    where p.is_active = true
      and (q.brand is null or b.name ilike '%' || q.brand || '%')
      and greatest(
        similarity(coalesce(p.name,''), q.name),
        similarity(coalesce(p.name_fr,''), q.name),
        similarity(coalesce(p.name_en,''), q.name)
      ) >= _threshold
    order by sim desc
    limit 1
  ) m on true;
$$;

GRANT EXECUTE ON FUNCTION public.match_products_by_names_batch(jsonb, double precision) TO anon, authenticated, service_role;