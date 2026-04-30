
create or replace function public.admin_price_cockpit_gaps_v2(
  _country text default null,
  _brand_id uuid default null,
  _search text default null,
  _min_rfq_count integer default 0,
  _only_with_demand boolean default false,
  _limit integer default 300
)
returns table (
  product_id uuid,
  product_name text,
  cnk text,
  brand_name text,
  brand_id uuid,
  external_best_ht numeric,
  external_offers_count integer,
  pvp_ttc numeric,
  popularity numeric,
  rfq_count_90d integer,
  rfq_total_qty_90d integer,
  last_rfq_at timestamptz,
  priority_score numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s text := nullif(trim(_search), '');
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  return query
  with base as (
    select p.id, p.name, p.cnk_code, p.brand_name, p.brand_id, p.popularity, p.pvp_ttc_cents
    from public.products p
    where p.is_active = true
      and (_brand_id is null or p.brand_id = _brand_id)
      and (s is null
           or p.name ilike '%'||s||'%'
           or p.brand_name ilike '%'||s||'%'
           or p.cnk_code ilike '%'||s||'%')
      and not exists (
        select 1 from public.offers o
        where o.product_id = p.id
          and o.is_active = true
          and (_country is null or o.country_code = _country)
      )
  ),
  ext as (
    select e.product_id,
           min(e.unit_price) as best_ht,
           count(*)::int as cnt
    from public.external_offers e
    where e.is_active
      and e.product_id in (select id from base)
    group by e.product_id
  ),
  rfq as (
    select r.product_id,
           count(*)::int as cnt,
           coalesce(sum(r.quantity), 0)::int as qty,
           max(r.created_at) as last_at
    from public.rfqs r
    where r.product_id in (select id from base)
      and r.created_at >= now() - interval '90 days'
      and (_country is null or r.destination_country_code = _country)
    group by r.product_id
  )
  select
    b.id,
    b.name,
    b.cnk_code,
    b.brand_name,
    b.brand_id,
    ext.best_ht,
    coalesce(ext.cnt, 0),
    (b.pvp_ttc_cents::numeric / 100.0),
    b.popularity,
    coalesce(rfq.cnt, 0),
    coalesce(rfq.qty, 0),
    rfq.last_at,
    -- Priority score: RFQ count weights heavily, popularity boost, external availability bonus
    (
      coalesce(rfq.cnt, 0) * 10.0
      + least(coalesce(b.popularity, 0), 100) * 0.5
      + case when ext.best_ht is not null then 5 else 0 end
      + case when rfq.last_at is not null and rfq.last_at >= now() - interval '14 days' then 15 else 0 end
    )::numeric as priority_score
  from base b
  left join ext on ext.product_id = b.id
  left join rfq on rfq.product_id = b.id
  where (coalesce(rfq.cnt, 0) >= coalesce(_min_rfq_count, 0))
    and (not _only_with_demand or coalesce(rfq.cnt, 0) > 0)
  order by priority_score desc nulls last, b.name asc
  limit _limit;
end;
$$;

revoke all on function public.admin_price_cockpit_gaps_v2(text, uuid, text, integer, boolean, integer) from public;
grant execute on function public.admin_price_cockpit_gaps_v2(text, uuid, text, integer, boolean, integer) to authenticated;
