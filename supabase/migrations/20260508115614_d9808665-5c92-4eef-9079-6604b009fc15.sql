
insert into storage.buckets (id, name, public) values ('brand-logos', 'brand-logos', true) on conflict (id) do nothing;

create policy "Brand logos public read" on storage.objects for select using (bucket_id = 'brand-logos');
create policy "Admins upload brand logos" on storage.objects for insert to authenticated with check (bucket_id = 'brand-logos' and public.is_admin(auth.uid()));
create policy "Admins update brand logos" on storage.objects for update to authenticated using (bucket_id = 'brand-logos' and public.is_admin(auth.uid()));
create policy "Admins delete brand logos" on storage.objects for delete to authenticated using (bucket_id = 'brand-logos' and public.is_admin(auth.uid()));
