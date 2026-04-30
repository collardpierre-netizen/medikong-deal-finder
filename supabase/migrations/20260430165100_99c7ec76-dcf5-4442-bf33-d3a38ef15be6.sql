-- 1. Table : log des challenges envoyés aux vendeurs
create table if not exists public.vendor_price_challenges (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references public.vendors(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  offer_id        uuid references public.offers(id) on delete set null,
  reason          text not null check (reason in ('vs_external','vs_internal','vs_pvp','negative_margin','no_offer')),
  ref_price_ht    numeric,
  mk_price_ht     numeric,
  delta_pct       numeric,
  message         text,
  notification_id uuid references public.vendor_notifications(id) on delete set null,
  sent_by         uuid references auth.users(id) on delete set null,
  responded_at    timestamptz,
  responded_delta_pct numeric,
  created_at      timestamptz not null default now()
);

create index if not exists idx_vpc_vendor on public.vendor_price_challenges(vendor_id, created_at desc);
create index if not exists idx_vpc_product on public.vendor_price_challenges(product_id, created_at desc);
create index if not exists idx_vpc_recent on public.vendor_price_challenges(created_at desc);

alter table public.vendor_price_challenges enable row level security;

drop policy if exists "vpc_admin_all" on public.vendor_price_challenges;
create policy "vpc_admin_all" on public.vendor_price_challenges
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "vpc_vendor_read_own" on public.vendor_price_challenges;
create policy "vpc_vendor_read_own" on public.vendor_price_challenges
  for select to authenticated
  using (vendor_id in (select id from public.vendors where auth_user_id = auth.uid()));

-- 2. RPC : lignes du cockpit
create or replace function public.admin_price_cockpit_rows(
  _country         text default null,
  _brand_id        uuid default null,
  _category_id     uuid default null,
  _min_delta_pct   numeric default null,
  _only_mk_higher  boolean default true,
  _limit           int default 200,
  _offset          int default 0
)
returns table(
  product_id           uuid,
  product_name         text,
  cnk                  text,
  brand_name           text,
  brand_id             uuid,
  category_id          uuid,
  mk_best_ht           numeric,
  mk_best_offer_id     uuid,
  mk_best_vendor_id    uuid,
  mk_best_vendor_name  text,
  mk_offers_count      int,
  mk_2nd_ht            numeric,
  external_best_ht     numeric,
  external_best_source text,
  external_best_url    text,
  market_pharm_ht      numeric,
  market_grossiste_ht  numeric,
  market_public_ht     numeric,
  pvp_ttc              numeric,
  delta_vs_external_pct numeric,
  delta_vs_internal_pct numeric,
  worst_action_score   numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'forbidden'; end if;

  return query
  with mk_offers as (
    select o.product_id, o.id as offer_id, o.vendor_id, o.price_excl_vat as ht,
           row_number() over (partition by o.product_id order by o.price_excl_vat asc) as rn,
           count(*) over (partition by o.product_id) as cnt
    from public.offers o
    where o.is_active = true
      and (_country is null or o.country_code = _country)
  ),
  mk_best as (select product_id, offer_id, vendor_id, ht as mk_best_ht, cnt as mk_offers_count from mk_offers where rn = 1),
  mk_2nd  as (select product_id, ht as mk_2nd_ht from mk_offers where rn = 2),
  ext_best as (
    select e.product_id,
           min(e.unit_price) as external_best_ht,
           (array_agg(ev.name order by e.unit_price asc))[1] as external_best_source,
           (array_agg(e.product_url order by e.unit_price asc))[1] as external_best_url
    from public.external_offers e
    join public.external_vendors ev on ev.id = e.external_vendor_id
    where e.is_active = true
    group by e.product_id
  ),
  market_agg as (
    select mp.product_id,
           min(mp.prix_pharmacien) as pharm_ht,
           min(mp.prix_grossiste) as grossiste_ht,
           min(mp.prix_public) as public_ht
    from public.market_prices mp
    where mp.product_id is not null
    group by mp.product_id
  )
  select p.id, p.name, p.cnk_code, p.brand_name, p.brand_id, p.category_id,
    mb.mk_best_ht, mb.offer_id, mb.vendor_id,
    coalesce(v.company_name, v.name),
    mb.mk_offers_count::int, m2.mk_2nd_ht,
    eb.external_best_ht, eb.external_best_source, eb.external_best_url,
    ma.pharm_ht, ma.grossiste_ht, ma.public_ht,
    (p.pvp_ttc_cents::numeric / 100.0),
    case when eb.external_best_ht is not null and eb.external_best_ht > 0 and mb.mk_best_ht is not null
         then round(((mb.mk_best_ht - eb.external_best_ht) / eb.external_best_ht) * 100, 1) end,
    case when m2.mk_2nd_ht is not null and m2.mk_2nd_ht > 0 and mb.mk_best_ht is not null
         then round(((mb.mk_best_ht - m2.mk_2nd_ht) / m2.mk_2nd_ht) * 100, 1) end,
    greatest(
      coalesce( case when eb.external_best_ht > 0 then ((mb.mk_best_ht - eb.external_best_ht) / eb.external_best_ht) * 100 end, 0),
      coalesce( case when ma.pharm_ht > 0 then ((mb.mk_best_ht - ma.pharm_ht) / ma.pharm_ht) * 100 end, 0),
      coalesce( case when ma.grossiste_ht > 0 then ((mb.mk_best_ht - ma.grossiste_ht) / ma.grossiste_ht) * 100 end, 0)
    )
  from public.products p
  join mk_best mb on mb.product_id = p.id
  left join mk_2nd m2 on m2.product_id = p.id
  left join ext_best eb on eb.product_id = p.id
  left join market_agg ma on ma.product_id = p.id
  left join public.vendors v on v.id = mb.vendor_id
  where p.is_active = true
    and (_brand_id is null or p.brand_id = _brand_id)
    and (_category_id is null or p.category_id = _category_id)
    and (
      _only_mk_higher = false
      or (eb.external_best_ht is not null and mb.mk_best_ht > eb.external_best_ht)
      or (ma.pharm_ht is not null and mb.mk_best_ht > ma.pharm_ht)
      or (ma.grossiste_ht is not null and mb.mk_best_ht > ma.grossiste_ht)
      or (m2.mk_2nd_ht is not null and mb.mk_best_ht > m2.mk_2nd_ht)
    )
    and (
      _min_delta_pct is null
      or greatest(
           coalesce( case when eb.external_best_ht > 0 then ((mb.mk_best_ht - eb.external_best_ht) / eb.external_best_ht) * 100 end, 0),
           coalesce( case when ma.pharm_ht > 0 then ((mb.mk_best_ht - ma.pharm_ht) / ma.pharm_ht) * 100 end, 0),
           coalesce( case when ma.grossiste_ht > 0 then ((mb.mk_best_ht - ma.grossiste_ht) / ma.grossiste_ht) * 100 end, 0)
         ) >= _min_delta_pct
    )
  order by 22 desc nulls last, p.name asc
  limit _limit offset _offset;
end;
$$;

grant execute on function public.admin_price_cockpit_rows(text, uuid, uuid, numeric, boolean, int, int) to authenticated;

-- 3. RPC : KPIs globaux
create or replace function public.admin_price_cockpit_kpis(_country text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _r jsonb;
begin
  if not public.is_admin(auth.uid()) then raise exception 'forbidden'; end if;
  with mk_best as (
    select o.product_id, min(o.price_excl_vat) as mk_ht
    from public.offers o where o.is_active = true and (_country is null or o.country_code = _country)
    group by o.product_id
  ),
  ext_best as (select product_id, min(unit_price) as ext_ht from public.external_offers where is_active = true group by product_id),
  mk_internal as (
    select product_id, count(*) as cnt, min(price_excl_vat) as p1,
           (array_agg(price_excl_vat order by price_excl_vat))[2] as p2
    from public.offers where is_active = true and (_country is null or country_code = _country)
    group by product_id
  ),
  active_products as (select id from public.products where is_active = true)
  select jsonb_build_object(
    'mk_higher_than_external', (select count(*) from mk_best mb join ext_best eb using(product_id) where mb.mk_ht > eb.ext_ht),
    'mk_higher_internal', (select count(*) from mk_internal where cnt >= 2 and p1 < p2),
    'active_products_total', (select count(*) from active_products),
    'active_products_without_offer', (select count(*) from active_products ap where not exists (select 1 from mk_best where product_id = ap.id)),
    'avg_delta_vs_external_pct', (select round(avg( ((mb.mk_ht - eb.ext_ht) / nullif(eb.ext_ht,0)) * 100 )::numeric, 1)
                                  from mk_best mb join ext_best eb using(product_id) where eb.ext_ht > 0)
  ) into _r;
  return _r;
end;
$$;
grant execute on function public.admin_price_cockpit_kpis(text) to authenticated;

-- 4. RPC : trous catalogue
create or replace function public.admin_price_cockpit_gaps(
  _country text default null, _brand_id uuid default null, _limit int default 200
)
returns table(
  product_id uuid, product_name text, cnk text, brand_name text, brand_id uuid,
  external_best_ht numeric, pvp_ttc numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'forbidden'; end if;
  return query
  select p.id, p.name, p.cnk_code, p.brand_name, p.brand_id,
         (select min(unit_price) from public.external_offers e where e.product_id = p.id and e.is_active),
         (p.pvp_ttc_cents::numeric / 100.0)
  from public.products p
  where p.is_active = true
    and (_brand_id is null or p.brand_id = _brand_id)
    and not exists (
      select 1 from public.offers o
      where o.product_id = p.id and o.is_active = true
        and (_country is null or o.country_code = _country)
    )
  order by p.name asc limit _limit;
end;
$$;
grant execute on function public.admin_price_cockpit_gaps(text, uuid, int) to authenticated;

-- 5. RPC : log d'un challenge
create or replace function public.admin_log_price_challenge(
  _vendor_id uuid, _product_id uuid, _offer_id uuid, _reason text,
  _ref_price_ht numeric, _mk_price_ht numeric, _delta_pct numeric,
  _message text, _notification_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  if not public.is_admin(auth.uid()) then raise exception 'forbidden'; end if;
  insert into public.vendor_price_challenges(
    vendor_id, product_id, offer_id, reason,
    ref_price_ht, mk_price_ht, delta_pct, message, notification_id, sent_by
  ) values (
    _vendor_id, _product_id, _offer_id, _reason,
    _ref_price_ht, _mk_price_ht, _delta_pct, _message, _notification_id, auth.uid()
  ) returning id into _id;
  return _id;
end;
$$;
grant execute on function public.admin_log_price_challenge(uuid, uuid, uuid, text, numeric, numeric, numeric, text, uuid) to authenticated;