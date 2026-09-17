-- Le nom client affiché à l'apporteur retombe sur customers (raison sociale)
-- quand le profil acheteur n'a ni company_name ni full_name renseignés.
create or replace function public._affiliate_client_display_name(_user_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select nullif(trim(p.company_name), '') from public.profiles p where p.user_id = _user_id),
    (select nullif(trim(cu.company_name), '') from public.customers cu where cu.auth_user_id = _user_id order by cu.created_at limit 1),
    (select nullif(trim(p.full_name), '') from public.profiles p where p.user_id = _user_id)
  )
$$;
