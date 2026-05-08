
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'category_source_aliases_path_locale_uniq') then
    delete from category_source_aliases a using category_source_aliases b
     where a.ctid < b.ctid
       and a.source_path = b.source_path
       and a.source_locale is not distinct from b.source_locale;
    alter table category_source_aliases
      add constraint category_source_aliases_path_locale_uniq unique (source_path, source_locale);
  end if;
end $$;

insert into categories (slug, name, name_fr, name_nl, name_en, parent_id, level, display_order, is_featured_top, is_active, status)
values
  ('mk-otc-medicaments',          'MK · OTC & Médicaments',           'OTC & Médicaments',           'OTC & Geneesmiddelen',         'OTC & Medicines',           null, 1,  1, true,  true, 'active'),
  ('mk-complements-nutrition',    'MK · Compléments & nutrition',     'Compléments & nutrition',     'Supplementen & voeding',       'Supplements & nutrition',   null, 1,  2, true,  true, 'active'),
  ('mk-hygiene-desinfection',     'MK · Hygiène & désinfection',      'Hygiène & désinfection',      'Hygiëne & desinfectie',        'Hygiene & disinfection',    null, 1,  3, true,  true, 'active'),
  ('mk-pansements-soins-plaies',  'MK · Pansements & soins de plaies','Pansements & soins de plaies','Verbanden & wondzorg',         'Dressings & wound care',    null, 1,  4, true,  true, 'active'),
  ('mk-diagnostic-autonomie',     'MK · Diagnostic & autonomie',      'Diagnostic & autonomie',      'Diagnose & zelfredzaamheid',   'Diagnostics & mobility',    null, 1,  5, true,  true, 'active'),
  ('mk-soins-infirmiers',         'MK · Soins infirmiers',            'Soins infirmiers',            'Verpleegkundige zorg',         'Nursing care',              null, 1,  6, true,  true, 'active'),
  ('mk-maman-bebe',               'MK · Maman & bébé',                'Maman & bébé',                'Mama & baby',                  'Mom & baby',                null, 1,  7, true,  true, 'active'),
  ('mk-dermatocosmetique',        'MK · Dermatocosmétique',           'Dermatocosmétique',           'Dermatocosmetica',             'Dermocosmetics',            null, 1,  8, true,  true, 'active'),
  ('mk-soin-corps-mains',         'MK · Soin corps & mains',          'Soin corps & mains',          'Lichaams- & handverzorging',   'Body & hand care',          null, 1,  9, true,  true, 'active'),
  ('mk-capillaire-coiffure',      'MK · Capillaire & coiffure',       'Capillaire & coiffure',       'Haarverzorging & kapsel',      'Hair & salon',              null, 1, 10, true,  true, 'active'),
  ('mk-maquillage-ongles',        'MK · Maquillage & ongles',         'Maquillage & ongles',         'Make-up & nagels',             'Makeup & nails',            null, 1, 11, true,  true, 'active'),
  ('mk-parfumerie',               'MK · Parfumerie',                  'Parfumerie',                  'Parfumerie',                   'Perfumery',                 null, 1, 12, true,  true, 'active'),
  ('mk-medecines-complementaires','MK · Médecines complémentaires',   'Médecines complémentaires',   'Complementaire geneeskunde',   'Complementary medicine',    null, 1, 90, false, true, 'active'),
  ('mk-hygiene-domestique',       'MK · Hygiène domestique',          'Hygiène domestique',          'Huishoudelijke hygiëne',       'Household hygiene',         null, 1, 91, false, true, 'active')
on conflict (slug) do update
  set name = excluded.name,
      name_fr = excluded.name_fr,
      name_nl = excluded.name_nl,
      name_en = excluded.name_en,
      level = excluded.level,
      display_order = excluded.display_order,
      is_featured_top = excluded.is_featured_top,
      is_active = excluded.is_active,
      status = excluded.status;

create or replace function public.auto_set_primary_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.primary_category_id is null and new.category_id is not null then
    select a.category_id into new.primary_category_id
      from public.categories c
      join public.category_source_aliases a
        on a.source_path = c.name
       and (a.source_locale = 'en' or a.source_locale is null)
     where c.id = new.category_id
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_primary_category on public.products;
create trigger trg_auto_primary_category
  before insert or update of category_id on public.products
  for each row execute function public.auto_set_primary_category();

create or replace view public.admin_unmapped_qogita_categories
with (security_invoker = true) as
select
  c.id          as qogita_category_id,
  c.name        as qogita_name,
  c.qogita_qid,
  count(p.id)   as products_count
  from public.categories c
  left join public.products p on p.category_id = c.id
 where (c.slug is null or c.slug not like 'mk-%')
   and not exists (
     select 1 from public.category_source_aliases a
      where a.source_path = c.name
        and (a.source_locale = 'en' or a.source_locale is null)
   )
 group by c.id, c.name, c.qogita_qid
 order by count(p.id) desc;

grant select on public.admin_unmapped_qogita_categories to authenticated;
