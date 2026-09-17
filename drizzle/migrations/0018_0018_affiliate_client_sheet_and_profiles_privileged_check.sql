-- 1) Fiche client accessible à l'apporteur (nom, contact, adresse, historique commandes)
--    Aucune donnée de coût vendeur / commission MediKong n'est exposée.

drop function if exists public.affiliate_my_referrals(uuid);

create or replace function public.affiliate_my_referrals(_affiliate_id uuid default null)
returns table(
  referral_id uuid,
  pseudo text,
  client_name text,
  attributed_at timestamptz,
  first_order_at timestamptz,
  window_expires_at timestamptz,
  status text,
  orders_count integer,
  revenue_ht_cents bigint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_aff uuid;
begin
  v_aff := public.affiliate_target_id(_affiliate_id);
  return query
  select r.id,
         'Client #' || upper(substr(md5(r.user_id::text || r.affiliate_id::text), 1, 4)),
         public._affiliate_client_display_name(r.user_id),
         r.attributed_at, r.first_order_at, r.window_expires_at, r.status,
         coalesce(cc.n, 0)::int, coalesce(cc.ht, 0)::bigint
  from public.affiliate_referrals r
  left join lateral (
    select count(*)::int as n, sum(c.order_total_ht_cents)::bigint as ht
    from public.affiliate_commissions c
    where c.referral_id = r.id and c.adjustment_of_id is null and c.status <> 'cancelled'
  ) cc on true
  where r.affiliate_id = v_aff
  order by r.attributed_at desc;
end;
$$;

create or replace function public.affiliate_my_client(_referral_id uuid, _affiliate_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_aff uuid;
  v_ref record;
  v_result jsonb;
begin
  v_aff := public.affiliate_target_id(_affiliate_id);

  select r.* into v_ref
  from public.affiliate_referrals r
  where r.id = _referral_id and r.affiliate_id = v_aff;

  if v_ref.id is null then
    raise exception 'Acces refuse';
  end if;

  select jsonb_build_object(
    'referral_id', v_ref.id,
    'pseudo', 'Client #' || upper(substr(md5(v_ref.user_id::text || v_ref.affiliate_id::text), 1, 4)),
    'status', v_ref.status,
    'attributed_at', v_ref.attributed_at,
    'first_order_at', v_ref.first_order_at,
    'window_expires_at', v_ref.window_expires_at,
    'client_name', coalesce(public._affiliate_client_display_name(v_ref.user_id), cu.company_name),
    'contact_name', p.full_name,
    'email', coalesce(cu.email, au.email),
    'phone', coalesce(cu.phone, p.phone),
    'customer_type', cu.customer_type::text,
    'vat_number', coalesce(cu.vat_number, p.vat_number),
    'address_line1', cu.address_line1,
    'address_line2', cu.address_line2,
    'postal_code', cu.postal_code,
    'city', cu.city,
    'country', coalesce(cu.country_code, p.country),
    'preferred_language', p.preferred_language,
    'is_verified', cu.is_verified,
    'orders', coalesce(o.orders, '[]'::jsonb),
    'stats', jsonb_build_object(
      'orders_count', coalesce(o.n, 0),
      'revenue_ht_cents', coalesce(o.ht, 0),
      'last_order_at', o.last_order_at
    )
  )
  into v_result
  from (select 1) dummy
  left join public.customers cu on cu.auth_user_id = v_ref.user_id
  left join public.profiles p on p.user_id = v_ref.user_id
  left join auth.users au on au.id = v_ref.user_id
  left join lateral (
    select count(*)::int as n,
           coalesce(sum(c.order_total_ht_cents), 0)::bigint as ht,
           max(ord.created_at) as last_order_at,
           jsonb_agg(jsonb_build_object(
             'order_id', ord.id,
             'order_number', ord.order_number,
             'created_at', ord.created_at,
             'status', ord.status,
             'payment_status', ord.payment_status,
             'total_ht_cents', c.order_total_ht_cents
           ) order by ord.created_at desc) as orders
    from public.affiliate_commissions c
    join public.orders ord on ord.id = c.order_id
    where c.referral_id = v_ref.id
      and c.adjustment_of_id is null
      and c.status <> 'cancelled'
  ) o on true;

  return v_result;
end;
$$;

grant execute on function public.affiliate_my_referrals(uuid) to authenticated;
grant execute on function public.affiliate_my_client(uuid, uuid) to authenticated;

-- 2) Sécurité : verrouillage des colonnes privilégiées de profiles au niveau des policies
create or replace function public._profiles_privileged_intact(_id uuid, _price_level_code text, _buyer_profile_id text, _is_founder boolean, _founder_since timestamptz, _founder_source text, _activated_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public._is_admin_or_service()
      or not exists (
        select 1 from public.profiles p
        where p.id = _id
          and (p.price_level_code is distinct from _price_level_code
            or p.buyer_profile_id is distinct from _buyer_profile_id
            or p.is_founder is distinct from _is_founder
            or p.founder_since is distinct from _founder_since
            or p.founder_source is distinct from _founder_source
            or p.activated_at is distinct from _activated_at)
      );
$$;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and public._profiles_privileged_intact(id, price_level_code, buyer_profile_id, is_founder, founder_since, founder_source, activated_at)
);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    public._is_admin_or_service()
    or (coalesce(is_founder, false) = false
        and founder_since is null
        and founder_source is null
        and activated_at is null)
  )
);
