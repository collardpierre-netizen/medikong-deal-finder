
-- 1) Settings table (singleton)
create table if not exists public.price_challenge_settings (
  id boolean primary key default true check (id),
  cooldown_days integer not null default 7 check (cooldown_days >= 0),
  min_delta_pct numeric not null default 2 check (min_delta_pct >= 0),
  max_per_vendor_per_day integer not null default 5 check (max_per_vendor_per_day > 0),
  updated_at timestamptz not null default now()
);

insert into public.price_challenge_settings (id) values (true)
on conflict (id) do nothing;

alter table public.price_challenge_settings enable row level security;

drop policy if exists "pcs_admin_read" on public.price_challenge_settings;
create policy "pcs_admin_read" on public.price_challenge_settings
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "pcs_admin_write" on public.price_challenge_settings;
create policy "pcs_admin_write" on public.price_challenge_settings
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 2) Cooldown check RPC
create or replace function public.check_price_challenge_cooldown(
  _vendor_id uuid,
  _product_id uuid
)
returns table (
  allowed boolean,
  block_reason text,
  last_sent_at timestamptz,
  next_allowed_at timestamptz,
  sent_today integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.price_challenge_settings;
  v_last timestamptz;
  v_today int;
begin
  if not public.is_admin(auth.uid()) then raise exception 'forbidden'; end if;

  select * into s from public.price_challenge_settings where id = true;

  select max(created_at) into v_last
  from public.vendor_price_challenges
  where vendor_id = _vendor_id and product_id = _product_id;

  select count(*)::int into v_today
  from public.vendor_price_challenges
  where vendor_id = _vendor_id
    and created_at >= date_trunc('day', now());

  if v_today >= s.max_per_vendor_per_day then
    return query select false,
      'daily_quota_reached'::text,
      v_last,
      (date_trunc('day', now()) + interval '1 day')::timestamptz,
      v_today;
    return;
  end if;

  if v_last is not null and v_last > now() - make_interval(days => s.cooldown_days) then
    return query select false,
      'cooldown_active'::text,
      v_last,
      (v_last + make_interval(days => s.cooldown_days))::timestamptz,
      v_today;
    return;
  end if;

  return query select true, null::text, v_last, null::timestamptz, v_today;
end;
$$;

revoke all on function public.check_price_challenge_cooldown(uuid, uuid) from public;
grant execute on function public.check_price_challenge_cooldown(uuid, uuid) to authenticated;

-- 3) Reinforce admin_log_price_challenge with cooldown enforcement
create or replace function public.admin_log_price_challenge(
  _vendor_id uuid,
  _product_id uuid,
  _offer_id uuid,
  _reason text,
  _ref_price_ht numeric,
  _mk_price_ht numeric,
  _delta_pct numeric,
  _message text,
  _notification_id uuid default null,
  _force boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
  s public.price_challenge_settings;
  v_last timestamptz;
  v_today int;
begin
  if not public.is_admin(auth.uid()) then raise exception 'forbidden'; end if;

  if not coalesce(_force, false) then
    select * into s from public.price_challenge_settings where id = true;

    if _delta_pct is not null and abs(_delta_pct) < s.min_delta_pct then
      raise exception 'price_challenge_blocked: delta % below threshold %', _delta_pct, s.min_delta_pct
        using errcode = 'P0001';
    end if;

    select count(*)::int into v_today
    from public.vendor_price_challenges
    where vendor_id = _vendor_id and created_at >= date_trunc('day', now());

    if v_today >= s.max_per_vendor_per_day then
      raise exception 'price_challenge_blocked: daily quota reached for vendor (%/% today)',
        v_today, s.max_per_vendor_per_day using errcode = 'P0001';
    end if;

    select max(created_at) into v_last
    from public.vendor_price_challenges
    where vendor_id = _vendor_id and product_id = _product_id;

    if v_last is not null and v_last > now() - make_interval(days => s.cooldown_days) then
      raise exception 'price_challenge_blocked: cooldown active until %',
        (v_last + make_interval(days => s.cooldown_days))::text using errcode = 'P0001';
    end if;
  end if;

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

-- 4) Auto-mark response when vendor lowers price within 30 days post-challenge
create or replace function public.trg_detect_price_challenge_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old numeric;
  v_new numeric;
begin
  v_old := coalesce(OLD.price_excl_vat, 0)::numeric;
  v_new := coalesce(NEW.price_excl_vat, 0)::numeric;
  if v_new >= v_old or v_old = 0 then
    return NEW;
  end if;

  update public.vendor_price_challenges c
  set responded_at = now(),
      responded_delta_pct = round(((v_new - c.mk_price_ht) / nullif(c.mk_price_ht, 0)) * 100, 2)
  where c.vendor_id = NEW.vendor_id
    and c.product_id = NEW.product_id
    and c.responded_at is null
    and c.created_at >= now() - interval '30 days';

  return NEW;
end;
$$;

drop trigger if exists trg_offers_detect_challenge_response on public.offers;
create trigger trg_offers_detect_challenge_response
  after update of price_excl_vat on public.offers
  for each row
  when (OLD.price_excl_vat is distinct from NEW.price_excl_vat)
  execute function public.trg_detect_price_challenge_response();

-- 5) Metrics view per vendor
create or replace view public.vendor_price_challenge_metrics_v
with (security_invoker = true) as
select
  c.vendor_id,
  v.name as vendor_name,
  count(*)::int as total_challenges,
  count(*) filter (where c.responded_at is not null)::int as responded_count,
  round(
    100.0 * count(*) filter (where c.responded_at is not null)::numeric
    / nullif(count(*), 0)::numeric, 1
  ) as response_rate_pct,
  round(avg(c.responded_delta_pct) filter (where c.responded_at is not null), 2) as avg_response_delta_pct,
  round(avg(extract(epoch from (c.responded_at - c.created_at)) / 86400.0)
    filter (where c.responded_at is not null), 1) as avg_response_days,
  max(c.created_at) as last_sent_at,
  max(c.created_at) filter (where c.responded_at is null) as last_open_challenge_at,
  count(*) filter (where c.created_at >= now() - interval '30 days')::int as sent_30d,
  count(*) filter (where c.responded_at is not null and c.responded_at >= now() - interval '30 days')::int as responded_30d
from public.vendor_price_challenges c
left join public.vendors v on v.id = c.vendor_id
group by c.vendor_id, v.name;

revoke all on public.vendor_price_challenge_metrics_v from public, anon, authenticated;
grant select on public.vendor_price_challenge_metrics_v to authenticated;
