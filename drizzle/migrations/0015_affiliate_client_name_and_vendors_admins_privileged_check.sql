-- Nom d'affichage client : société si présente, sinon nom complet (jamais email/téléphone).
create or replace function public._affiliate_client_display_name(_user_id uuid)
returns text
language sql stable security definer
set search_path to 'public'
as $$
  select coalesce(nullif(trim(p.company_name), ''), nullif(trim(p.full_name), ''))
  from public.profiles p
  where p.user_id = _user_id
$$;

-- affiliate_my_referrals : ajoute client_name. DROP nécessaire car le type de retour change.
drop function if exists public.affiliate_my_referrals(uuid);

create function public.affiliate_my_referrals(_affiliate_id uuid default null)
returns table(
  pseudo text,
  client_name text,
  attributed_at timestamptz,
  first_order_at timestamptz,
  window_expires_at timestamptz,
  status text,
  orders_count int,
  revenue_ht_cents bigint
)
language plpgsql stable security definer
set search_path to 'public'
as $$
declare v_aff uuid;
begin
  v_aff := public.affiliate_target_id(_affiliate_id);
  return query
  select 'Client #' || upper(substr(md5(r.user_id::text || r.affiliate_id::text), 1, 4)),
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

-- Sécurité : vendors_admins_update ne doit plus permettre de modifier les champs
-- contrôlés par la plateforme (commission, vérification, activation, statut de validation).
drop policy if exists vendors_admins_update on public.vendors;
create policy vendors_admins_update
on public.vendors
for update
to authenticated
using (is_account_admin('vendor'::text, id))
with check (
  is_account_admin('vendor'::text, id)
  and _vendors_privileged_intact(id, validation_status, is_verified, is_active, commission_rate, commission_model, margin_split_pct, fixed_commission_amount)
);