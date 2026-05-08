## Objectif

Construire une taxonomie maîtresse MediKong indépendante des feeds sources, traduite FR/NL/EN, ordonnée selon l'usage officine belge, mapper l'existant, puis brancher l'UI catalogue / sidebar / breadcrumb / promotions / admin.

## Découpage en 4 vagues

Le ticket est très large. Je propose de le livrer en 4 vagues distinctes, chacune approuvée avant la suivante. Cette demande couvre la **vague 1 (fondations DB + seed niveau 1)**, et je préviens des vagues 2/3/4 à venir.

---

## Vague 1 — Fondations DB + seed niveau 1 + premiers mappings (cette livraison)

### 1.1 Nouvelles tables

- `categories` (id, parent_id, slug unique, level, position, icon, is_visible, is_featured_top, status, timestamps).
- `category_translations` (category_id, locale ∈ fr/nl/en, name, description, meta_title, meta_description ; PK composite).
- `category_source_aliases` (id, source_path, source_locale nullable, category_id nullable, unique(source_path, coalesce(source_locale,''))).
- Vue `admin_unmapped_categories` (groupée par catégorie source non mappée, classée par volume).

### 1.2 Adaptation `catalog_products`

- Ajouter colonne nullable `primary_category_id uuid references categories(id)` + index.
- Garder l'ancienne colonne `category text` pendant la transition (hors scope explicite).

### 1.3 RLS

- Lecture publique sur `categories` (filtrée `is_visible=true and status='active'`) et `category_translations`.
- Écriture réservée aux rôles `admin` / `super_admin` via `has_role()` (pas de nouveau rôle `taxonomy_manager` pour rester aligné avec le RBAC actuel — à confirmer si tu veux un rôle dédié).
- `category_source_aliases` : lecture admin uniquement (mapping interne).

### 1.4 Seed

- 12 catégories niveau 1 selon le ticket, avec `is_featured_top=true` pour les 6 premières (OTC, Dermato, Hygiène, Pansements, Diagnostic, Diabète).
- Traductions FR/NL/EN niveau 1 (les 36 lignes du ticket).
- Première vague de `category_source_aliases` (15 entrées du ticket, dont quelques `category_id = null` pour explicitement « ignorer » : `Accessoires > Accessoires`, `Animal & Pet Repellents`, `Abattement – Désespoir`, `Lunettes et verres`).

### 1.5 RPC d'aide

- `apply_category_aliases()` : batch update `catalog_products.primary_category_id` depuis `category_source_aliases` quand alias matche `category` et `category_id is not null`. Idempotent.

### 1.6 Hook + lecture

- `src/hooks/useCategories.ts` : `useCategories(level, locale)` qui renvoie catégories visibles + traduction de la locale active, tri par `position`, fallback EN si traduction manquante (filtré côté client).
- Pas de modification UI dans cette vague — juste le hook et un mini test de smoke.

### 1.7 Bandeau de chips catalogue

- Suppression du bandeau de chips actuel sur `/catalogue` (cf. recommandation MVP du ticket : la sidebar suffit en B2B).

---

## Vagues suivantes (annoncées, pas dans cette livraison)

### Vague 2 — Niveau 2 + sidebar refondue
- Seed complet niveau 2 (≈ 60 sous-catégories) + traductions FR/NL/EN.
- Refonte `<CategorySidebar />` du catalogue : niveau 1 + déroulement niveau 2, compteur live de produits, masquage si `is_visible=false`.
- Brancher la sidebar `/promotions` sur la taxonomie maîtresse (tri par volume promo).

### Vague 3 — Breadcrumb + mapping en masse
- Breadcrumb fiche produit refondu sur `primary_category_id` + traductions.
- Élargir `category_source_aliases` à partir de `admin_unmapped_categories` (script semi-auto + écran admin de mapping).
- Lancer `apply_category_aliases()` en prod.

### Vague 4 — Back-office admin
- `/admin/catalogue/taxonomie` : arbre drag-and-drop, édition inline traductions, toggles visibility/featured.
- `/admin/catalogue/mappings` : CRUD `category_source_aliases`.
- `/admin/catalogue/categories-non-mappees` : vue `admin_unmapped_categories` avec mapper-vers en un clic.

---

## Détails techniques (vague 1)

### Migrations à créer

```sql
-- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  slug text not null unique,
  level smallint not null,
  position smallint not null default 0,
  icon text,
  is_visible boolean not null default true,
  is_featured_top boolean not null default false,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_categories_parent on public.categories(parent_id);
create index idx_categories_level_position on public.categories(level, position);

-- translations
create table public.category_translations (
  category_id uuid not null references public.categories(id) on delete cascade,
  locale text not null check (locale in ('fr','nl','en')),
  name text not null,
  description text,
  meta_title text,
  meta_description text,
  primary key (category_id, locale)
);
create index idx_category_translations_locale_name on public.category_translations(locale, name);

-- aliases
create table public.category_source_aliases (
  id uuid primary key default gen_random_uuid(),
  source_path text not null,
  source_locale text,
  category_id uuid references public.categories(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index ux_category_source_aliases_path_locale
  on public.category_source_aliases(source_path, coalesce(source_locale, ''));
create index idx_category_source_aliases_path on public.category_source_aliases(source_path);

-- catalog_products
alter table public.catalog_products
  add column if not exists primary_category_id uuid references public.categories(id);
create index if not exists idx_catalog_products_primary_category
  on public.catalog_products(primary_category_id);

-- updated_at trigger sur categories
create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.update_updated_at_column();

-- vue non-mappées
create view public.admin_unmapped_categories
with (security_invoker = true) as
select category, count(*)::int as products_count
  from public.catalog_products
 where primary_category_id is null
   and category is not null
 group by category
 order by count(*) desc;
```

### RLS

```sql
alter table public.categories enable row level security;
alter table public.category_translations enable row level security;
alter table public.category_source_aliases enable row level security;

-- lecture publique des catégories actives
create policy "categories public read"
  on public.categories for select
  using (is_visible = true and status = 'active');
create policy "categories admin all"
  on public.categories for all
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

-- traductions : lecture publique
create policy "category_translations public read"
  on public.category_translations for select using (true);
create policy "category_translations admin all"
  on public.category_translations for all
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

-- aliases : admin only (mapping interne)
create policy "category_source_aliases admin all"
  on public.category_source_aliases for all
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));
```

### RPC `apply_category_aliases`

```sql
create or replace function public.apply_category_aliases()
returns table(updated_count int)
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  if not (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'super_admin')) then
    raise exception 'forbidden';
  end if;
  update catalog_products p
     set primary_category_id = a.category_id
    from category_source_aliases a
   where p.primary_category_id is null
     and p.category = a.source_path
     and a.category_id is not null;
  get diagnostics v_count = row_count;
  return query select v_count;
end $$;
```

### Hook React

`src/hooks/useCategories.ts` — Query par locale (lit `useTranslation().i18n.language`), retourne `{ id, slug, name, icon, is_featured_top, position, parent_id }[]` triés par `position`.

### Suppression chips catalogue

Identifier le composant rendant le bandeau sur `CataloguePage.tsx` (probablement `CategoryChips` / `FeaturedCategories` dans `src/components/catalog/`) — vérifier le code à l'implémentation et retirer le rendu (pas le composant entier, juste l'usage), avec un commentaire renvoyant à la vague 2.

---

## Hors scope (rappel ticket)

- Pas de drop de `catalog_products.category`.
- Pas de SEO catégoriel automatique.
- Pas de refonte `catalog_products` au-delà de l'ajout colonne.
- Pas de changement de la mécanique des promotions.

---

## À confirmer avant exécution

1. **Rôle admin** : OK pour réutiliser `admin` + `super_admin` du RBAC actuel, sans créer `taxonomy_manager` ?
2. **Vague 1 seule** ou tu veux que j'enchaîne directement vague 2 (sidebar + niveau 2) après approbation ?
