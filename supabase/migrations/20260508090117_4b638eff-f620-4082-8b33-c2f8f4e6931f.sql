
do $$ begin
  create type public.home_featured_badge as enum ('bestseller','top_vente','nouveau','promo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.home_featured_locale as enum ('fr','nl','de','en','all');
exception when duplicate_object then null; end $$;

create table if not exists public.home_featured_brands (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  position smallint not null default 1,
  locale public.home_featured_locale not null default 'all',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, locale)
);
create index if not exists idx_home_featured_brands_locale_position
  on public.home_featured_brands (locale, position);
create index if not exists idx_home_featured_brands_valid_to
  on public.home_featured_brands (valid_to);

create table if not exists public.home_featured_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  position smallint not null default 1,
  locale public.home_featured_locale not null default 'all',
  badge public.home_featured_badge,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, locale)
);
create index if not exists idx_home_featured_products_locale_position
  on public.home_featured_products (locale, position);
create index if not exists idx_home_featured_products_valid_to
  on public.home_featured_products (valid_to);

create table if not exists public.home_featured_category_whitelist (
  category_id uuid primary key references public.categories(id) on delete cascade,
  added_by uuid,
  added_at timestamptz not null default now()
);

create or replace function public.touch_home_featured_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_home_featured_brands_touch on public.home_featured_brands;
create trigger trg_home_featured_brands_touch
before update on public.home_featured_brands
for each row execute function public.touch_home_featured_updated_at();

drop trigger if exists trg_home_featured_products_touch on public.home_featured_products;
create trigger trg_home_featured_products_touch
before update on public.home_featured_products
for each row execute function public.touch_home_featured_updated_at();

alter table public.home_featured_brands enable row level security;
alter table public.home_featured_products enable row level security;
alter table public.home_featured_category_whitelist enable row level security;

drop policy if exists hfb_select_public on public.home_featured_brands;
create policy hfb_select_public on public.home_featured_brands
  for select to anon, authenticated using (true);

drop policy if exists hfp_select_public on public.home_featured_products;
create policy hfp_select_public on public.home_featured_products
  for select to anon, authenticated using (true);

drop policy if exists hfcw_select_public on public.home_featured_category_whitelist;
create policy hfcw_select_public on public.home_featured_category_whitelist
  for select to anon, authenticated using (true);

drop policy if exists hfb_admin_write on public.home_featured_brands;
create policy hfb_admin_write on public.home_featured_brands
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists hfp_admin_write on public.home_featured_products;
create policy hfp_admin_write on public.home_featured_products
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists hfcw_admin_write on public.home_featured_category_whitelist;
create policy hfcw_admin_write on public.home_featured_category_whitelist
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop view if exists public.public_home_featured_brands_v cascade;
create view public.public_home_featured_brands_v
with (security_invoker = true)
as
select
  hb.id,
  hb.brand_id,
  b.name as brand_name,
  b.slug as brand_slug,
  b.logo_url,
  b.website_url,
  hb.position,
  hb.locale,
  hb.valid_from,
  hb.valid_to
from public.home_featured_brands hb
join public.brands b on b.id = hb.brand_id
where b.is_active = true
  and hb.valid_from <= now()
  and (hb.valid_to is null or hb.valid_to > now());

grant select on public.public_home_featured_brands_v to anon, authenticated;

drop view if exists public.public_home_featured_products_v cascade;
create view public.public_home_featured_products_v
with (security_invoker = true)
as
select
  hp.id,
  hp.product_id,
  p.name as product_name,
  p.slug as product_slug,
  p.image_url,
  p.image_urls,
  p.brand_id,
  p.brand_name,
  p.category_id,
  p.category_name,
  p.best_price_excl_vat,
  p.best_price_incl_vat,
  p.offer_count,
  hp.position,
  hp.locale,
  hp.badge,
  hp.valid_from,
  hp.valid_to
from public.home_featured_products hp
join public.products p on p.id = hp.product_id
where p.is_active = true
  and hp.valid_from <= now()
  and (hp.valid_to is null or hp.valid_to > now());

grant select on public.public_home_featured_products_v to anon, authenticated;

create or replace function public.admin_reorder_home_featured(
  _kind text,
  _ids  uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  i int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  if _kind = 'brands' then
    for i in 1 .. coalesce(array_length(_ids, 1), 0) loop
      update public.home_featured_brands
         set position = i, updated_at = now()
       where id = _ids[i];
    end loop;
  elsif _kind = 'products' then
    for i in 1 .. coalesce(array_length(_ids, 1), 0) loop
      update public.home_featured_products
         set position = i, updated_at = now()
       where id = _ids[i];
    end loop;
  else
    raise exception 'unknown kind: %', _kind;
  end if;
end;
$$;

revoke all on function public.admin_reorder_home_featured(text, uuid[]) from public;
grant execute on function public.admin_reorder_home_featured(text, uuid[]) to authenticated;
