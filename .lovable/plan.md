## Re-curation home : architecture pilotable

### Adaptation au schéma réel

Le ticket réfère à `catalog_brands` / `catalog_products` / `supplier_offer_items`. Schéma réel : `brands`, `products`, `offers`. Le bloc « Marques » de la home pioche déjà dans `brands.is_featured` (toggle dans `/admin/marques`), et le bloc « Tendances » dans `useFeaturedProducts(5)` qui sélectionne par popularité.

On garde `is_featured` comme **fallback rétro-compatible** mais on introduit le nouveau modèle riche par-dessus.

---

### 1. Migrations DB (un seul appel `supabase--migration`)

**Tables**
- `home_featured_brands(brand_id, position, locale, valid_from, valid_to, created_by, …)` — UNIQUE `(brand_id, locale)`
- `home_featured_products(product_id, position, locale, badge, valid_from, valid_to, created_by, …)` — UNIQUE `(product_id, locale)`, badge ∈ {bestseller, top_vente, nouveau, promo}
- `home_featured_category_whitelist(category_id PK)` — IDs de catégories autorisées pour fallback algo

**Vues** `security_invoker = true`
- `public_home_featured_brands_v` : join `brands` + filtre actif + fenêtre `valid_*`
- `public_home_featured_products_v` : join `products` + best_price (HTVA) via `effective_offer_prices_v` + offers_count + filtre `is_active=true` et offre active

**RLS**
- SELECT public sur les deux tables (vues + tables, pour le hook)
- INSERT/UPDATE/DELETE limité aux rôles `admin` / `super_admin` via `has_role()`
- Index partiels sur `(locale, position) WHERE valid_to IS NULL OR valid_to > now()`

**Pas de seed automatique dans la migration** : les noms exacts des marques varient. Bouton "Seed initial recommandé" dans l'admin (étape 4) qui propose la liste cible et insère uniquement les marques/produits trouvés (pré-visualisation avant validation).

---

### 2. Hooks React (`src/hooks/`)

- `useHomeFeaturedBrands()` → lit `public_home_featured_brands_v` filtré sur `[locale, 'all']`, tri par `position`. Si `< 6` lignes → renvoie `[]` (le bloc UI s'auto-masque).
- `useHomeFeaturedProducts()` → idem sur `public_home_featured_products_v`. Si `< 8` lignes ET fallback activé → complète automatiquement avec top produits dont `category_id ∈ home_featured_category_whitelist` triés par `offer_count` desc.

Cache `staleTime: 30 min`.

---

### 3. UI home (`src/pages/HomePage.tsx`)

- Section marques : remplacer le query `featured-brands-homepage` par `useHomeFeaturedBrands()`. Renommer `t("brands.title")` en `t("brands.referenceTitle")` ("Marques de référence"). Conserver carrousel infini.
- Section tendances : remplacer `useFeaturedProducts(5)` par `useHomeFeaturedProducts()`. Renommer le titre en "Best-sellers officine" via i18n. Ajouter rendu du badge (Bestseller / Top vente / Nouveau / Promo) en chip sur la vignette.
- Auto-masquage du bloc si liste vide (pas de placeholder cassé).
- Mise à jour `src/i18n/locales/{fr,nl,de,en}.json` (clés `home.brands.referenceTitle`, `home.products.bestSellersTitle`, badges).

---

### 4. Back-office admin

Deux pages route imbriquée sous `/admin/cms/home` (déjà un `AdminCMS` existe) :
- `/admin/cms/home/marques` — composant `<HomeFeaturedBrandsAdmin />`
- `/admin/cms/home/produits` — composant `<HomeFeaturedProductsAdmin />`

Chaque page :
- Table : Marque/Produit, Position (drag-and-drop via `@dnd-kit/sortable` déjà présent), Locale, Badge (produits), Validité (range datepicker), Actions.
- Ajout : combobox autocomplete (recherche `brands` / `products` par nom/cnk/gtin, debounce 250 ms, limit 20 résultats).
- Bouton "Aperçu home" → ouvre `/` dans nouvel onglet.
- Bouton "Seed initial recommandé" — dialog qui résout la liste cible (Bétadine/Avène/…/Voltaren…), affiche ce qui existe vs absent, valide en bulk-insert.

Sous-menu ajouté dans `AdminCMS` (onglet "Home Curation" avec deux sous-onglets).

RBAC : protégé via le wrapper `<LP>` (déjà admin-only) + RLS DB.

---

### 5. Cleanup

- Plus de marques/produits hardcodés dans `HomePage.tsx`. (Aujourd'hui la home pioche déjà en DB, donc principalement renommage + bascule de hook.)
- Documenter dans `mem://features/home-curation-pilotable` : tables, vues, route admin, fallback whitelist.

---

### Détails techniques

**Best price** : utiliser `effective_offer_prices_v` déjà existante (`min(htva_price_cents)` group by product_id) et `country` du contexte si pertinent.

**Locale** : récupérée via `useTranslation().i18n.language.split('-')[0]`. Filtre `.in("locale", [locale, "all"])`.

**Drag-and-drop** : update `position` en bulk RPC `admin_reorder_home_featured(_kind text, _ids uuid[])` qui boucle et set `position = idx + 1`.

**Badges** : enum Postgres `home_featured_badge` (bestseller, top_vente, nouveau, promo).

---

### Hors-scope confirmé

- Pas de bannières saisonnières (ticket séparé).
- Pas de refonte du layout home.
- Chiffres clés et bloc "MediKong vs sourcing" intacts.

---

### Étapes d'exécution une fois validé

1. Migration DB (tables + vues + RLS + RPC reorder + enum badge).
2. Hooks `useHomeFeaturedBrands` / `useHomeFeaturedProducts`.
3. Branchement `HomePage.tsx` + i18n + masquage conditionnel.
4. Pages admin + onglet dans `AdminCMS` + autocomplete + drag-and-drop + dialog seed.
5. Mémoire projet.

OK pour démarrer ?