## Objectif

Permettre à un acheteur vérifié de chercher tous les produits/offres offrant au moins X% de remise vs un prix de référence (PVP **ou** prix marché), filtrer par marque/fabricant et exporter le résultat. Le même filtre est aussi exposé en sidebar sur `/catalogue`.

## Périmètre

### 1. Backend — RPC `search_discount_offers`
Nouvelle fonction SQL `security_invoker = true`, restreinte aux acheteurs vérifiés (sinon `raise exception 'unauthorized'`).

Paramètres :
- `_reference text` — `'pvp'` ou `'market'`
- `_min_discount_pct numeric` — ex. 50 (= 50% mini)
- `_brand_ids uuid[]` — optionnel
- `_manufacturer_ids uuid[]` — optionnel
- `_country text` — `BE`/`FR`/`LU`/`ALL`
- `_categories uuid[]` — optionnel
- `_limit int default 100`, `_offset int default 0`

Retourne par ligne : `product_id, product_name, brand_id, brand_name, manufacturer_id, manufacturer_name, vendor_id, vendor_name, best_price_htva_cents, reference_price_cents, discount_pct, country, pack_size, total_count`.

Source : `effective_offer_prices_v` (meilleur prix par produit/pays) jointe à `products_with_country_stats_v` (pour `market_price_*`) et `resolve_product_pvp(product_id)` (PVP). Calcul du delta côté SQL, filtre `discount_pct >= _min_discount_pct`, tri `discount_pct DESC`. `total_count` via window function.

### 2. Page dédiée `/bonnes-affaires`
Nouvelle route protégée par `RequireVerifiedBuyer` (composant existant).

Layout :
- En-tête : titre + sous-titre explicatif
- Bloc "Critères" (sticky desktop) :
  - Toggle référence : **PVP conseillé** / **Prix marché moyen** (par défaut PVP)
  - Slider + input numérique : remise mini (10–90%, défaut 30%)
  - MultiSelect Marques (réutilise `useBrands`)
  - MultiSelect Fabricants (réutilise `useManufacturers`)
  - Select pays
  - Boutons : Rechercher / Réinitialiser / **Exporter XLSX** / **Exporter CSV**
- Résultats : tableau paginé (100/page, useInfiniteQuery) — colonnes Produit, Marque, Fabricant, Vendeur, Prix HTVA, Prix réf., Économie %, Stock + lien fiche produit. État empty/loading/error explicites.

### 3. Entrée menu
Ajout dans `Header` (menu principal acheteur) d'un lien "Bonnes affaires" (icône `Tag` ou `Percent`) visible uniquement si `isVerifiedBuyer`. Pour les non-vérifiés : route accessible mais affiche un teaser → CTA vers KYC.

### 4. Filtre sidebar `/catalogue`
Dans `CatalogFilters` :
- Nouveau bloc collapsible "Remise vs prix public" avec :
  - Mini-toggle PVP / Marché
  - Slider 0–90% (défaut 0 = inactif)
- Branchement dans `useCatalogProducts` : nouveaux params `minDiscountPct` + `discountReference`. Côté SQL, on ajoute deux helpers dans `products_with_country_stats_v` (déjà colonnes `country_min_price_cents` et `country_market_price_cents`) + lecture de `pvp_ttc_cents` directement sur `products`. Filtre :
  - `discount = 1 - (best_price_htva / reference_ttc_or_htva)`
  - On compare HTVA vs HTVA (PVP TTC ramené HTVA via `resolve_product_vat_rate`).
- Query string : `?remise=50&ref=pvp` (partageable).

### 5. Export
- **XLSX** : helper `exportDiscountResultsXlsx` (basé sur `xlsx` déjà utilisé dans le comparateur acheteur) — onglet "Bonnes affaires", colonnes alignées sur le tableau, filtres appliqués mentionnés en en-tête.
- **CSV** : export client (Blob `text/csv;charset=utf-8`), même colonnes, séparateur `;` (Excel-FR).
- Export full résultat (jusqu'à 5000 lignes, RPC appelée avec `_limit=5000`).

## Détails techniques

```
src/
  pages/BonnesAffairesPage.tsx                (nouvelle route)
  components/discount/
    DiscountCriteriaForm.tsx
    DiscountResultsTable.tsx
    DiscountExportButtons.tsx
  hooks/useDiscountSearch.ts                  (RPC + infinite query)
  lib/discount-export.ts                      (xlsx + csv)
src/components/catalog/CatalogFilters.tsx     (+ bloc Remise)
src/hooks/useCatalogProducts.ts               (+ params minDiscountPct/ref)
src/components/Header.tsx                     (+ lien menu)
src/App.tsx                                   (+ <Route path="/bonnes-affaires">)
supabase/migrations/*.sql                     (RPC search_discount_offers + grants)
```

Aucune modif des autres pages, aucune autre migration. Pas de cache MV — la RPC requête à la volée (PVP+market déjà denormalisés dans la vue).

## Hors périmètre (à confirmer plus tard)

- Sauvegarde des "recherches favorites" (alertes email auto si nouveaux produits matchent)
- Filtre par catégorie (le multiselect catégorie reste sur /catalogue — ajout possible v2)
- Export PDF
- Visibilité partielle pour non-vérifiés (teaser uniquement)

## Question ouverte avant code

Le filtre côté `/catalogue` doit-il **persister** dans `profiles.preferences` (comme le toggle Trivago/Grid) ou rester volatile par session ? Par défaut je pars sur **volatile + query string** — plus simple, partageable, et n'altère pas les préférences globales.