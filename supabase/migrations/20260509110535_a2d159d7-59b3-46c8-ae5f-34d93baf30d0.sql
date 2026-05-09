create extension if not exists pg_trgm with schema extensions;

-- Référence ville BE
create table if not exists public.be_city_to_province (
  city_normalized text primary key,
  city_label text not null,
  province text not null,
  postal_code_prefix text
);
alter table public.be_city_to_province enable row level security;
create policy "be_city_to_province public read"
  on public.be_city_to_province for select to anon, authenticated using (true);

insert into public.be_city_to_province (city_normalized, city_label, province, postal_code_prefix) values
  ('bruxelles', 'Bruxelles', 'Bruxelles-Capitale', '1'),
  ('brussels', 'Brussels', 'Bruxelles-Capitale', '1'),
  ('brussel', 'Brussel', 'Bruxelles-Capitale', '1'),
  ('anvers', 'Anvers', 'Anvers', '2'),
  ('antwerpen', 'Antwerpen', 'Anvers', '2'),
  ('antwerp', 'Antwerp', 'Anvers', '2'),
  ('gand', 'Gand', 'Flandre-Orientale', '9'),
  ('gent', 'Gent', 'Flandre-Orientale', '9'),
  ('ghent', 'Ghent', 'Flandre-Orientale', '9'),
  ('bruges', 'Bruges', 'Flandre-Occidentale', '8'),
  ('brugge', 'Brugge', 'Flandre-Occidentale', '8'),
  ('liege', 'Liège', 'Liège', '4'),
  ('liège', 'Liège', 'Liège', '4'),
  ('luik', 'Luik', 'Liège', '4'),
  ('charleroi', 'Charleroi', 'Hainaut', '6'),
  ('mons', 'Mons', 'Hainaut', '7'),
  ('bergen', 'Bergen', 'Hainaut', '7'),
  ('namur', 'Namur', 'Namur', '5'),
  ('namen', 'Namen', 'Namur', '5'),
  ('louvain', 'Louvain', 'Brabant Flamand', '3'),
  ('leuven', 'Leuven', 'Brabant Flamand', '3'),
  ('hasselt', 'Hasselt', 'Limbourg', '3'),
  ('arlon', 'Arlon', 'Luxembourg', '6'),
  ('aarlen', 'Aarlen', 'Luxembourg', '6'),
  ('wavre', 'Wavre', 'Brabant Wallon', '1'),
  ('nivelles', 'Nivelles', 'Brabant Wallon', '1'),
  ('ath', 'Ath', 'Hainaut', '7'),
  ('tournai', 'Tournai', 'Hainaut', '7'),
  ('mouscron', 'Mouscron', 'Hainaut', '7'),
  ('verviers', 'Verviers', 'Liège', '4'),
  ('ostende', 'Ostende', 'Flandre-Occidentale', '8'),
  ('oostende', 'Oostende', 'Flandre-Occidentale', '8'),
  ('courtrai', 'Courtrai', 'Flandre-Occidentale', '8'),
  ('kortrijk', 'Kortrijk', 'Flandre-Occidentale', '8'),
  ('malines', 'Malines', 'Anvers', '2'),
  ('mechelen', 'Mechelen', 'Anvers', '2')
on conflict (city_normalized) do nothing;

-- savings_simulations
create table if not exists public.savings_simulations (
  id uuid primary key default gen_random_uuid(),
  email text,
  pharmacy_name text,
  city text,
  region text,
  vat_number text,
  source_supplier text not null check (source_supplier in ('febelco','cerp','pharma_belgium','other')),
  source_file_path text,
  source_file_type text check (source_file_type in ('pdf','image','csv')),
  total_lines integer default 0,
  matched_lines integer default 0,
  match_rate numeric(4,3),
  source_total_excl_vat numeric(12,2),
  medikong_total_excl_vat numeric(12,2),
  savings_amount numeric(12,2),
  savings_pct numeric(5,2),
  status text not null default 'processing' check (status in ('processing','done','failed','no_match')),
  error_message text,
  report_path text,
  email_sent_at timestamptz,
  consent_given_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_savings_simulations_email on public.savings_simulations(email);
create index if not exists idx_savings_simulations_created on public.savings_simulations(created_at desc);
create index if not exists idx_savings_simulations_status on public.savings_simulations(status) where status = 'processing';
alter table public.savings_simulations enable row level security;
create policy "savings_simulations public read by id"
  on public.savings_simulations for select to anon, authenticated using (true);

create or replace function public.set_savings_simulations_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_savings_simulations_updated_at on public.savings_simulations;
create trigger trg_savings_simulations_updated_at
  before update on public.savings_simulations
  for each row execute function public.set_savings_simulations_updated_at();

-- savings_simulation_lines
create table if not exists public.savings_simulation_lines (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.savings_simulations(id) on delete cascade,
  line_number smallint,
  raw_text text,
  detected_cnk text,
  detected_ean text,
  detected_proprietary_code text,
  detected_name text,
  detected_brand text,
  detected_quantity integer,
  detected_unit_price_excl_vat numeric(10,2),
  matched_product_id uuid references public.products(id) on delete set null,
  match_confidence numeric(4,3),
  match_method text check (match_method in ('cnk','ean','proprietary_code','name_exact','name_fuzzy','llm','no_match')),
  medikong_min_price_excl_vat numeric(10,2),
  medikong_supplier_count integer,
  line_savings numeric(10,2),
  line_savings_pct numeric(5,2),
  created_at timestamptz not null default now()
);
create index if not exists idx_simulation_lines_simulation on public.savings_simulation_lines(simulation_id);
create index if not exists idx_simulation_lines_savings on public.savings_simulation_lines(simulation_id, line_savings desc nulls last);
alter table public.savings_simulation_lines enable row level security;
create policy "savings_simulation_lines public read"
  on public.savings_simulation_lines for select to anon, authenticated using (true);

-- supplier_proprietary_codes
create table if not exists public.supplier_proprietary_codes (
  id uuid primary key default gen_random_uuid(),
  source_supplier text not null check (source_supplier in ('febelco','cerp','pharma_belgium','other')),
  proprietary_code text not null,
  proprietary_label text,
  matched_product_id uuid references public.products(id) on delete set null,
  confidence numeric(4,3),
  match_method text check (match_method in ('manual','auto_inferred','llm','rejected')),
  observation_count integer not null default 1,
  last_observed_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_supplier, proprietary_code)
);
create index if not exists idx_supplier_codes_supplier on public.supplier_proprietary_codes(source_supplier);
create index if not exists idx_supplier_codes_unreviewed on public.supplier_proprietary_codes(observation_count desc) where reviewed_at is null;
alter table public.supplier_proprietary_codes enable row level security;
create policy "supplier_proprietary_codes admin read"
  on public.supplier_proprietary_codes for select to authenticated
  using (public.is_admin(auth.uid()));
create policy "supplier_proprietary_codes admin write"
  on public.supplier_proprietary_codes for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- market_price_observations
create table if not exists public.market_price_observations (
  id uuid primary key default gen_random_uuid(),
  source_supplier text not null check (source_supplier in ('febelco','cerp','pharma_belgium','other')),
  product_id uuid references public.products(id) on delete set null,
  observed_unit_price_excl_vat numeric(10,2) not null,
  observed_quantity integer,
  week_observed date not null,
  region text,
  pharmacy_size_bucket text check (pharmacy_size_bucket in ('small','medium','large')),
  created_at timestamptz not null default now()
);
create index if not exists idx_mpo_product_week on public.market_price_observations(product_id, week_observed desc);
create index if not exists idx_mpo_supplier_product on public.market_price_observations(source_supplier, product_id);
alter table public.market_price_observations enable row level security;
create policy "market_price_observations admin read"
  on public.market_price_observations for select to authenticated
  using (public.is_admin(auth.uid()));

-- Vue agrégée k-anonyme
create or replace view public.market_intelligence_v
with (security_invoker = true) as
select
  product_id,
  source_supplier,
  date_trunc('week', week_observed)::date as week,
  count(*)::integer as observations_count,
  round(percentile_cont(0.5) within group (order by observed_unit_price_excl_vat)::numeric, 2) as median_price,
  round(percentile_cont(0.25) within group (order by observed_unit_price_excl_vat)::numeric, 2) as q1_price,
  round(percentile_cont(0.75) within group (order by observed_unit_price_excl_vat)::numeric, 2) as q3_price,
  round(min(observed_unit_price_excl_vat)::numeric, 2) as min_price,
  round(max(observed_unit_price_excl_vat)::numeric, 2) as max_price
from public.market_price_observations
group by product_id, source_supplier, date_trunc('week', week_observed)
having count(*) >= 5;
revoke all on public.market_intelligence_v from anon, authenticated;
grant select on public.market_intelligence_v to authenticated;

-- RPCs
create or replace function public.match_product_by_name(
  query_name text,
  query_brand text default null,
  threshold float default 0.55
)
returns table (id uuid, name text, similarity float)
language sql stable
security definer
set search_path = public, extensions
as $$
  select p.id, p.name,
         greatest(
           similarity(coalesce(p.name, ''), query_name),
           similarity(coalesce(p.name_fr, ''), query_name),
           similarity(coalesce(p.name_en, ''), query_name)
         )::float as sim
    from public.products p
    left join public.brands b on b.id = p.brand_id
   where p.is_active = true
     and (query_brand is null or b.name ilike '%' || query_brand || '%')
     and greatest(
       similarity(coalesce(p.name, ''), query_name),
       similarity(coalesce(p.name_fr, ''), query_name),
       similarity(coalesce(p.name_en, ''), query_name)
     ) >= threshold
   order by sim desc
   limit 5;
$$;
revoke all on function public.match_product_by_name(text, text, float) from public;
grant execute on function public.match_product_by_name(text, text, float) to service_role, authenticated;

create or replace function public.increment_proprietary_code_observation(
  _supplier text, _code text
) returns void language sql security definer set search_path = public as $$
  update public.supplier_proprietary_codes
     set observation_count = observation_count + 1,
         last_observed_at = now()
   where source_supplier = _supplier and proprietary_code = _code;
$$;
revoke all on function public.increment_proprietary_code_observation(text, text) from public;
grant execute on function public.increment_proprietary_code_observation(text, text) to service_role;

create or replace function public.cleanup_old_savings_simulations()
returns integer language plpgsql security definer set search_path = public as $$
declare _count integer;
begin
  with updated as (
    update public.savings_simulations
       set source_file_path = null
     where created_at < now() - interval '30 days'
       and source_file_path is not null
    returning 1
  )
  select count(*)::integer into _count from updated;
  return coalesce(_count, 0);
end;
$$;
revoke all on function public.cleanup_old_savings_simulations() from public;
grant execute on function public.cleanup_old_savings_simulations() to service_role;

create or replace function public.auto_promote_proprietary_codes()
returns integer language plpgsql security definer set search_path = public as $$
declare _count integer;
begin
  with updated as (
    update public.supplier_proprietary_codes
       set match_method = 'auto_inferred', reviewed_at = now()
     where match_method = 'llm'
       and observation_count >= 10
       and confidence >= 0.85
       and reviewed_at is null
    returning 1
  )
  select count(*)::integer into _count from updated;
  return coalesce(_count, 0);
end;
$$;
revoke all on function public.auto_promote_proprietary_codes() from public;
grant execute on function public.auto_promote_proprietary_codes() to service_role;

-- Storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'savings-uploads', 'savings-uploads', false, 10485760,
  array['application/pdf','image/jpeg','image/png','text/csv','application/vnd.ms-excel']
) on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'savings-reports', 'savings-reports', true, 10485760,
  array['application/pdf']
) on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "savings-uploads admin read"
  on storage.objects for select to authenticated
  using (bucket_id = 'savings-uploads' and public.is_admin(auth.uid()));

create policy "savings-reports public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'savings-reports');

-- Cron jobs
do $$ begin perform cron.unschedule('cleanup-savings-simulations-daily'); exception when others then null; end $$;
select cron.schedule('cleanup-savings-simulations-daily', '0 3 * * *', $$ select public.cleanup_old_savings_simulations(); $$);

do $$ begin perform cron.unschedule('auto-promote-proprietary-codes-daily'); exception when others then null; end $$;
select cron.schedule('auto-promote-proprietary-codes-daily', '0 4 * * *', $$ select public.auto_promote_proprietary_codes(); $$);