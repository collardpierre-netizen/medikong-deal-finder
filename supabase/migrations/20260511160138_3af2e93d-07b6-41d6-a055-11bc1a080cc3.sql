
create table if not exists public.pricing_plans (
  id text primary key, label text not null, description text,
  trial_months int not null default 6, bonus_months int not null default 6, extension_months int not null default 3,
  volume_threshold_ht numeric(12,2) not null default 6000, volume_currency text not null default 'EUR',
  monthly_price_ht numeric(12,2) not null default 199, vat_rate numeric(5,2) not null default 21,
  is_active boolean default true, effective_from date, effective_to date,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
insert into public.pricing_plans (id, label, description, trial_months, bonus_months, extension_months, volume_threshold_ht, monthly_price_ht, vat_rate, is_active)
values ('pharmacien_standard_2026','Pharmacien — Offre standard 2026',
        '6 mois free, +6 mois si volume ≥ 6 000 € HT, sinon 199 € HT/mois. Extension manuelle 3 mois possible.',
        6,6,3,6000,199,21,true) on conflict (id) do nothing;

create table if not exists public.buyer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null,
  plan_id text not null references public.pricing_plans(id),
  status text not null default 'trial' check (status in ('trial','bonus_free','extension_free','paid','paused','canceled')),
  trial_started_at timestamptz not null default now(), trial_ends_at timestamptz not null,
  bonus_eligible boolean default false, bonus_started_at timestamptz, bonus_ends_at timestamptz,
  extension_started_at timestamptz, extension_ends_at timestamptz,
  extension_granted_by uuid, extension_granted_at timestamptz,
  paid_started_at timestamptz, paid_monthly_price_ht numeric(12,2), paid_vat_rate numeric(5,2),
  paid_current_period_start date, paid_current_period_end date, paid_next_invoice_at date, paid_canceled_at timestamptz,
  volume_threshold_ht numeric(12,2), trial_volume_ht numeric(12,2) default 0, lifetime_volume_ht numeric(12,2) default 0,
  auto_switch_to_paid boolean default true, notes text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (buyer_id)
);
create index if not exists idx_buyer_subs_status on public.buyer_subscriptions(status);
create index if not exists idx_buyer_subs_trial_ends on public.buyer_subscriptions(trial_ends_at);
create index if not exists idx_buyer_subs_bonus_ends on public.buyer_subscriptions(bonus_ends_at);
create index if not exists idx_buyer_subs_extension_ends on public.buyer_subscriptions(extension_ends_at);

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.buyer_subscriptions(id) on delete cascade,
  buyer_id uuid not null, event_type text not null, payload jsonb,
  performed_by_user_id uuid, occurred_at timestamptz default now(), created_at timestamptz default now()
);
create index if not exists idx_sub_events_sub on public.subscription_events(subscription_id, occurred_at desc);
create index if not exists idx_sub_events_type on public.subscription_events(event_type);

create table if not exists public.subscription_extension_requests (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.buyer_subscriptions(id) on delete cascade,
  buyer_id uuid not null,
  status text not null default 'pending' check (status in ('pending','contacted','approved','rejected','expired')),
  reason text, callback_window text, context_snapshot jsonb,
  contact_attempt_count int default 0, last_contact_at timestamptz, contact_notes text,
  assigned_to_user_id uuid, resolved_by_user_id uuid, resolved_at timestamptz,
  granted_months int, rejection_reason text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists idx_ext_req_status on public.subscription_extension_requests(status);
create index if not exists idx_ext_req_buyer on public.subscription_extension_requests(buyer_id);
create index if not exists idx_ext_req_assigned on public.subscription_extension_requests(assigned_to_user_id, status);

create or replace function public.current_buyer_id()
returns uuid language sql stable security definer set search_path = public
as $$ select auth.uid() $$;

create or replace function public._sub_is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_admin(auth.uid()) $$;

create or replace view public.v_buyer_subscription_overview
with (security_invoker = true) as
select
  s.id as subscription_id, s.buyer_id, s.status, s.plan_id, p.label as plan_label,
  coalesce(s.volume_threshold_ht, p.volume_threshold_ht) as volume_threshold_ht,
  s.trial_volume_ht, s.lifetime_volume_ht,
  case s.status when 'trial' then 'free_initial' when 'bonus_free' then 'bonus_free'
    when 'extension_free' then 'extension_free' when 'paid' then 'paid'
    when 'paused' then 'paused' when 'canceled' then 'canceled' end as current_phase,
  case s.status when 'trial' then s.trial_ends_at when 'bonus_free' then s.bonus_ends_at
    when 'extension_free' then s.extension_ends_at else null end as current_free_ends_at,
  case when s.status in ('trial','bonus_free','extension_free') then
    greatest(0, ceil(extract(epoch from (case s.status
      when 'trial' then s.trial_ends_at when 'bonus_free' then s.bonus_ends_at
      when 'extension_free' then s.extension_ends_at end - now())) / 86400)::int)
    else null end as free_days_remaining,
  case when coalesce(s.volume_threshold_ht, p.volume_threshold_ht) > 0
    then least(100, round(100 * s.trial_volume_ht / coalesce(s.volume_threshold_ht, p.volume_threshold_ht)))::int
    else 0 end as threshold_progress_pct,
  exists (select 1 from public.subscription_extension_requests r
          where r.subscription_id = s.id and r.status in ('pending','contacted')) as has_active_extension_request,
  s.trial_started_at, s.trial_ends_at, s.bonus_started_at, s.bonus_ends_at,
  s.extension_started_at, s.extension_ends_at, s.paid_started_at, s.created_at, s.updated_at
from public.buyer_subscriptions s
join public.pricing_plans p on p.id = s.plan_id;

create or replace function public.recompute_buyer_volume(_buyer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_sub public.buyer_subscriptions; v_trial numeric(12,2); v_life numeric(12,2);
begin
  select * into v_sub from public.buyer_subscriptions where buyer_id = _buyer_id;
  if v_sub.id is null then return; end if;
  select coalesce(sum(o.subtotal_excl_vat),0) into v_life from public.orders o
   where o.customer_id = _buyer_id
     and o.status::text in ('confirmed','processing','partially_shipped','shipped','delivered')
     and o.deleted_at is null;
  select coalesce(sum(o.subtotal_excl_vat),0) into v_trial from public.orders o
   where o.customer_id = _buyer_id
     and o.status::text in ('confirmed','processing','partially_shipped','shipped','delivered')
     and o.deleted_at is null and o.created_at >= v_sub.trial_started_at and o.created_at < v_sub.trial_ends_at;
  update public.buyer_subscriptions set trial_volume_ht=v_trial, lifetime_volume_ht=v_life, updated_at=now() where id=v_sub.id;
  if v_trial >= coalesce(v_sub.volume_threshold_ht,
       (select volume_threshold_ht from public.pricing_plans where id = v_sub.plan_id))
     and not exists (select 1 from public.subscription_events
                     where subscription_id=v_sub.id and event_type='volume.threshold_reached') then
    insert into public.subscription_events (subscription_id, buyer_id, event_type, payload)
    values (v_sub.id, _buyer_id, 'volume.threshold_reached', jsonb_build_object('trial_volume_ht', v_trial));
  end if;
end; $$;

create or replace function public.trg_orders_recompute_volume()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then perform public.recompute_buyer_volume(old.customer_id); return old;
  else perform public.recompute_buyer_volume(new.customer_id);
       if tg_op='UPDATE' and old.customer_id is distinct from new.customer_id then
         perform public.recompute_buyer_volume(old.customer_id); end if;
       return new;
  end if;
end; $$;
drop trigger if exists trg_orders_subscription_volume on public.orders;
create trigger trg_orders_subscription_volume
after insert or update of status, subtotal_excl_vat, customer_id, deleted_at or delete
on public.orders for each row execute function public.trg_orders_recompute_volume();

create or replace function public.request_subscription_extension(_reason text default null, _callback_window text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_sub public.buyer_subscriptions; v_id uuid; v_days int;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select * into v_sub from public.buyer_subscriptions where buyer_id = auth.uid();
  if v_sub.id is null then raise exception 'no subscription'; end if;
  if v_sub.status not in ('trial','bonus_free','extension_free') then raise exception 'invalid status'; end if;
  if exists (select 1 from public.subscription_extension_requests
             where subscription_id=v_sub.id and status in ('pending','contacted')) then
    raise exception 'request already pending'; end if;
  v_days := case v_sub.status
    when 'trial' then ceil(extract(epoch from (v_sub.trial_ends_at - now())) / 86400)::int
    when 'bonus_free' then ceil(extract(epoch from (v_sub.bonus_ends_at - now())) / 86400)::int
    when 'extension_free' then ceil(extract(epoch from (v_sub.extension_ends_at - now())) / 86400)::int end;
  insert into public.subscription_extension_requests
    (subscription_id, buyer_id, status, reason, callback_window, context_snapshot)
  values (v_sub.id, auth.uid(), 'pending', _reason, _callback_window,
          jsonb_build_object('trial_volume_ht', v_sub.trial_volume_ht, 'days_remaining', v_days, 'phase', v_sub.status))
  returning id into v_id;
  insert into public.subscription_events (subscription_id, buyer_id, event_type, payload, performed_by_user_id)
  values (v_sub.id, auth.uid(), 'extension.requested',
          jsonb_build_object('request_id', v_id, 'reason', _reason), auth.uid());
  return v_id;
end; $$;

create or replace function public.ensure_buyer_subscription()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_plan public.pricing_plans;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select id into v_id from public.buyer_subscriptions where buyer_id = auth.uid();
  if v_id is not null then return v_id; end if;
  select * into v_plan from public.pricing_plans where id = 'pharmacien_standard_2026';
  insert into public.buyer_subscriptions (buyer_id, plan_id, status, trial_started_at, trial_ends_at, volume_threshold_ht)
  values (auth.uid(), v_plan.id, 'trial', now(),
          now() + make_interval(months => v_plan.trial_months), v_plan.volume_threshold_ht)
  returning id into v_id;
  insert into public.subscription_events (subscription_id, buyer_id, event_type, performed_by_user_id)
  values (v_id, auth.uid(), 'subscription.created', auth.uid());
  insert into public.subscription_events (subscription_id, buyer_id, event_type, performed_by_user_id)
  values (v_id, auth.uid(), 'trial.started', auth.uid());
  return v_id;
end; $$;

create or replace function public.assign_extension_request(_req_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._sub_is_admin() then raise exception 'forbidden'; end if;
  update public.subscription_extension_requests set assigned_to_user_id=auth.uid(), updated_at=now() where id=_req_id;
end; $$;

create or replace function public.mark_extension_contacted(_req_id uuid, _notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_req public.subscription_extension_requests;
begin
  if not public._sub_is_admin() then raise exception 'forbidden'; end if;
  update public.subscription_extension_requests
     set status='contacted', contact_attempt_count=contact_attempt_count+1, last_contact_at=now(),
         contact_notes = case when _notes is null then contact_notes
           else coalesce(contact_notes,'') ||
                case when contact_notes is not null then E'\n--- ' || to_char(now(),'YYYY-MM-DD HH24:MI') || E' ---\n' else '' end || _notes end,
         updated_at=now()
   where id=_req_id returning * into v_req;
  if v_req.id is not null then
    insert into public.subscription_events (subscription_id, buyer_id, event_type, payload, performed_by_user_id)
    values (v_req.subscription_id, v_req.buyer_id, 'extension.contacted',
            jsonb_build_object('request_id', _req_id), auth.uid());
  end if;
end; $$;

create or replace function public.grant_subscription_extension(_req_id uuid, _months int default 3, _notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_req public.subscription_extension_requests; v_end timestamptz;
begin
  if not public._sub_is_admin() then raise exception 'forbidden'; end if;
  select * into v_req from public.subscription_extension_requests where id=_req_id;
  if v_req.id is null then raise exception 'not found'; end if;
  v_end := now() + make_interval(months => coalesce(_months,3));
  update public.buyer_subscriptions
     set status='extension_free', extension_started_at=now(), extension_ends_at=v_end,
         extension_granted_by=auth.uid(), extension_granted_at=now(), updated_at=now()
   where id=v_req.subscription_id;
  update public.subscription_extension_requests
     set status='approved', granted_months=coalesce(_months,3), resolved_by_user_id=auth.uid(),
         resolved_at=now(),
         contact_notes = coalesce(contact_notes,'') || case when _notes is not null then E'\n[grant] ' || _notes else '' end,
         updated_at=now()
   where id=_req_id;
  insert into public.subscription_events (subscription_id, buyer_id, event_type, payload, performed_by_user_id)
  values (v_req.subscription_id, v_req.buyer_id, 'extension.granted',
          jsonb_build_object('request_id', _req_id, 'months', coalesce(_months,3), 'ends_at', v_end), auth.uid());
  insert into public.subscription_events (subscription_id, buyer_id, event_type, payload, performed_by_user_id)
  values (v_req.subscription_id, v_req.buyer_id, 'extension.started',
          jsonb_build_object('ends_at', v_end), auth.uid());
end; $$;

create or replace function public.reject_extension_request(_req_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_req public.subscription_extension_requests;
begin
  if not public._sub_is_admin() then raise exception 'forbidden'; end if;
  if _reason is null or length(trim(_reason))=0 then raise exception 'reason required'; end if;
  update public.subscription_extension_requests
     set status='rejected', rejection_reason=_reason, resolved_by_user_id=auth.uid(),
         resolved_at=now(), updated_at=now() where id=_req_id returning * into v_req;
  if v_req.id is not null then
    insert into public.subscription_events (subscription_id, buyer_id, event_type, payload, performed_by_user_id)
    values (v_req.subscription_id, v_req.buyer_id, 'extension.rejected',
            jsonb_build_object('request_id', _req_id, 'reason', _reason), auth.uid());
  end if;
end; $$;

create or replace function public.force_bonus_volume(_sub_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._sub_is_admin() then raise exception 'forbidden'; end if;
  if _reason is null or length(trim(_reason))=0 then raise exception 'reason required'; end if;
  update public.buyer_subscriptions set bonus_eligible=true, updated_at=now() where id=_sub_id;
  insert into public.subscription_events (subscription_id, buyer_id, event_type, payload, performed_by_user_id)
  select id, buyer_id, 'bonus.forced', jsonb_build_object('reason', _reason), auth.uid()
    from public.buyer_subscriptions where id=_sub_id;
end; $$;

create or replace function public.force_switch_to_paid(_sub_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_sub public.buyer_subscriptions; v_plan public.pricing_plans;
begin
  if not public._sub_is_admin() then raise exception 'forbidden'; end if;
  select * into v_sub from public.buyer_subscriptions where id=_sub_id;
  select * into v_plan from public.pricing_plans where id=v_sub.plan_id;
  update public.buyer_subscriptions
     set status='paid', paid_started_at=now(),
         paid_monthly_price_ht=v_plan.monthly_price_ht, paid_vat_rate=v_plan.vat_rate,
         paid_current_period_start=current_date,
         paid_current_period_end=(current_date + interval '1 month')::date,
         paid_next_invoice_at=current_date, updated_at=now() where id=_sub_id;
  insert into public.subscription_events (subscription_id, buyer_id, event_type, payload, performed_by_user_id)
  values (_sub_id, v_sub.buyer_id, 'paid.activated',
          jsonb_build_object('forced', true, 'price_ht', v_plan.monthly_price_ht), auth.uid());
end; $$;

create or replace function public.pause_subscription(_sub_id uuid, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_sub public.buyer_subscriptions;
begin
  if not public._sub_is_admin() then raise exception 'forbidden'; end if;
  update public.buyer_subscriptions set status='paused', updated_at=now() where id=_sub_id returning * into v_sub;
  insert into public.subscription_events (subscription_id, buyer_id, event_type, payload, performed_by_user_id)
  values (_sub_id, v_sub.buyer_id, 'subscription.paused', jsonb_build_object('reason', _reason), auth.uid());
end; $$;

create or replace function public.cancel_subscription(_sub_id uuid, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_sub public.buyer_subscriptions;
begin
  if not public._sub_is_admin() then raise exception 'forbidden'; end if;
  update public.buyer_subscriptions set status='canceled', paid_canceled_at=now(), updated_at=now()
   where id=_sub_id returning * into v_sub;
  insert into public.subscription_events (subscription_id, buyer_id, event_type, payload, performed_by_user_id)
  values (_sub_id, v_sub.buyer_id, 'subscription.canceled', jsonb_build_object('reason', _reason), auth.uid());
end; $$;

create or replace function public.override_volume_threshold(_sub_id uuid, _new_threshold numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_sub public.buyer_subscriptions;
begin
  if not public._sub_is_admin() then raise exception 'forbidden'; end if;
  update public.buyer_subscriptions set volume_threshold_ht=_new_threshold, updated_at=now()
   where id=_sub_id returning * into v_sub;
  insert into public.subscription_events (subscription_id, buyer_id, event_type, payload, performed_by_user_id)
  values (_sub_id, v_sub.buyer_id, 'threshold.overridden',
          jsonb_build_object('new_threshold', _new_threshold), auth.uid());
end; $$;

create or replace function public.subscription_run_daily_tick()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sub record; v_plan public.pricing_plans;
        v_threshold numeric; v_phase_end timestamptz; v_offset int;
        v_b int:=0; v_p int:=0; v_pa int:=0; v_r int:=0; v_e int:=0;
begin
  for v_sub in
    select s.* from public.buyer_subscriptions s
    where s.status in ('trial','bonus_free','extension_free')
      and ((s.status='trial' and s.trial_ends_at <= now()) or
           (s.status='bonus_free' and s.bonus_ends_at <= now()) or
           (s.status='extension_free' and s.extension_ends_at <= now()))
  loop
    select * into v_plan from public.pricing_plans where id=v_sub.plan_id;
    v_threshold := coalesce(v_sub.volume_threshold_ht, v_plan.volume_threshold_ht);
    if exists (select 1 from public.subscription_extension_requests
                where subscription_id=v_sub.id and status in ('pending','contacted')) then
      insert into public.subscription_events (subscription_id, buyer_id, event_type)
      select v_sub.id, v_sub.buyer_id, 'trial.bascule_paused_pending_extension'
       where not exists (select 1 from public.subscription_events
                          where subscription_id=v_sub.id
                            and event_type='trial.bascule_paused_pending_extension'
                            and occurred_at > now() - interval '1 day');
      v_pa := v_pa+1; continue;
    end if;
    if v_sub.status='trial' and (v_sub.bonus_eligible or v_sub.trial_volume_ht >= v_threshold) then
      update public.buyer_subscriptions
         set status='bonus_free', bonus_eligible=true,
             bonus_started_at=v_sub.trial_ends_at,
             bonus_ends_at=v_sub.trial_ends_at + make_interval(months => v_plan.bonus_months),
             updated_at=now() where id=v_sub.id;
      insert into public.subscription_events (subscription_id, buyer_id, event_type, payload)
      values (v_sub.id, v_sub.buyer_id, 'bonus.granted',
              jsonb_build_object('volume_at_event', v_sub.trial_volume_ht, 'threshold', v_threshold));
      insert into public.subscription_events (subscription_id, buyer_id, event_type)
      values (v_sub.id, v_sub.buyer_id, 'bonus.started');
      v_b := v_b+1;
    elsif v_sub.auto_switch_to_paid then
      update public.buyer_subscriptions
         set status='paid',
             paid_started_at=case v_sub.status when 'trial' then v_sub.trial_ends_at
                                                when 'bonus_free' then v_sub.bonus_ends_at
                                                else v_sub.extension_ends_at end,
             paid_monthly_price_ht=v_plan.monthly_price_ht, paid_vat_rate=v_plan.vat_rate,
             paid_current_period_start=current_date,
             paid_current_period_end=(current_date + interval '1 month')::date,
             paid_next_invoice_at=current_date, updated_at=now() where id=v_sub.id;
      insert into public.subscription_events (subscription_id, buyer_id, event_type, payload)
      values (v_sub.id, v_sub.buyer_id, 'paid.activated',
              jsonb_build_object('price_ht', v_plan.monthly_price_ht, 'vat_rate', v_plan.vat_rate));
      v_p := v_p+1;
    else
      update public.buyer_subscriptions set status='canceled', updated_at=now() where id=v_sub.id;
      insert into public.subscription_events (subscription_id, buyer_id, event_type, payload)
      values (v_sub.id, v_sub.buyer_id, 'subscription.canceled',
              jsonb_build_object('reason','auto_switch_disabled'));
    end if;
  end loop;

  for v_sub in
    select s.* from public.buyer_subscriptions s where s.status in ('trial','bonus_free','extension_free')
  loop
    v_phase_end := case v_sub.status when 'trial' then v_sub.trial_ends_at
      when 'bonus_free' then v_sub.bonus_ends_at when 'extension_free' then v_sub.extension_ends_at end;
    foreach v_offset in array array[30,7,2] loop
      if v_phase_end is not null and v_phase_end > now()
         and v_phase_end <= now() + make_interval(days => v_offset)
         and v_phase_end > now() + make_interval(days => v_offset - 1)
         and not exists (select 1 from public.subscription_events
                          where subscription_id=v_sub.id and event_type='reminder.sent'
                            and (payload->>'offset_days')::int = v_offset) then
        insert into public.subscription_events (subscription_id, buyer_id, event_type, payload)
        values (v_sub.id, v_sub.buyer_id, 'reminder.sent',
                jsonb_build_object('offset_days', v_offset, 'phase', v_sub.status));
        v_r := v_r+1;
      end if;
    end loop;
  end loop;

  update public.subscription_extension_requests set status='expired', resolved_at=now(), updated_at=now()
   where status='pending' and created_at < now() - interval '14 days' and contact_attempt_count=0;
  get diagnostics v_e = row_count;

  return jsonb_build_object('bonus', v_b, 'paid', v_p, 'paused_pending_ext', v_pa,
                            'reminders', v_r, 'expired_requests', v_e, 'ran_at', now());
end; $$;

alter table public.pricing_plans enable row level security;
alter table public.buyer_subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.subscription_extension_requests enable row level security;

drop policy if exists pricing_plans_read on public.pricing_plans;
create policy pricing_plans_read on public.pricing_plans for select to authenticated using (true);
drop policy if exists pricing_plans_admin_write on public.pricing_plans;
create policy pricing_plans_admin_write on public.pricing_plans
  for all to authenticated using (public._sub_is_admin()) with check (public._sub_is_admin());

drop policy if exists buyer_subs_self_read on public.buyer_subscriptions;
create policy buyer_subs_self_read on public.buyer_subscriptions
  for select to authenticated using (buyer_id = auth.uid() or public._sub_is_admin());
drop policy if exists buyer_subs_admin_write on public.buyer_subscriptions;
create policy buyer_subs_admin_write on public.buyer_subscriptions
  for all to authenticated using (public._sub_is_admin()) with check (public._sub_is_admin());

drop policy if exists sub_events_self_read on public.subscription_events;
create policy sub_events_self_read on public.subscription_events
  for select to authenticated using (buyer_id = auth.uid() or public._sub_is_admin());
drop policy if exists sub_events_admin_write on public.subscription_events;
create policy sub_events_admin_write on public.subscription_events
  for all to authenticated using (public._sub_is_admin()) with check (public._sub_is_admin());

drop policy if exists ext_req_self_read on public.subscription_extension_requests;
create policy ext_req_self_read on public.subscription_extension_requests
  for select to authenticated using (buyer_id = auth.uid() or public._sub_is_admin());
drop policy if exists ext_req_admin_write on public.subscription_extension_requests;
create policy ext_req_admin_write on public.subscription_extension_requests
  for all to authenticated using (public._sub_is_admin()) with check (public._sub_is_admin());

grant execute on function public.request_subscription_extension(text, text) to authenticated;
grant execute on function public.ensure_buyer_subscription() to authenticated;
grant execute on function public.recompute_buyer_volume(uuid) to authenticated;
grant execute on function public.assign_extension_request(uuid) to authenticated;
grant execute on function public.mark_extension_contacted(uuid, text) to authenticated;
grant execute on function public.grant_subscription_extension(uuid, int, text) to authenticated;
grant execute on function public.reject_extension_request(uuid, text) to authenticated;
grant execute on function public.force_bonus_volume(uuid, text) to authenticated;
grant execute on function public.force_switch_to_paid(uuid) to authenticated;
grant execute on function public.pause_subscription(uuid, text) to authenticated;
grant execute on function public.cancel_subscription(uuid, text) to authenticated;
grant execute on function public.override_volume_threshold(uuid, numeric) to authenticated;
grant execute on function public.subscription_run_daily_tick() to service_role;
