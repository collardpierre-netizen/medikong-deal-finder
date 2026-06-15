
create table public.vendor_attach_verifications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid not null,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_ip text,
  created_by_admin_id uuid,
  created_at timestamptz not null default now()
);

create index idx_vendor_attach_verif_vendor_pending
  on public.vendor_attach_verifications (vendor_id)
  where consumed_at is null;

grant select on public.vendor_attach_verifications to authenticated;
grant all on public.vendor_attach_verifications to service_role;

alter table public.vendor_attach_verifications enable row level security;

create policy "Admins read attach verifications"
  on public.vendor_attach_verifications
  for select
  to authenticated
  using (public.is_admin(auth.uid()));
