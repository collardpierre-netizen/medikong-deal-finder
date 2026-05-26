# Lot 2 + Lot 3 — Vendor Exclusivities

Lot 1a (moteur DB) déjà livré : table `vendor_exclusivities`, RPC `resolve_offer_exclusivity`, vues `offers_with_exclusivity_v` / `external_offers_with_exclusivity_v`, triggers overlap/block, cron horaire.

Ordre proposé : **Lot 2 d'abord** (pour pouvoir créer des règles depuis l'UI), **Lot 3 ensuite** (pour voir l'effet sans passer par SQL).

---

## Lot 2 — Admin CRUD `/admin/exclusivites`

### Page `src/pages/admin/AdminVendorExclusivitiesPage.tsx` (nouvelle)

- Liste filtrable des `vendor_exclusivities` :
  - Filtres : vendeur (Combobox), scope (`brand`/`manufacturer`/`product`/`category`), mode (`showcase`/`hide`/`block`), statut (actif / expiré / futur), pays.
  - Colonnes : Vendeur · Scope (badge) + cible résolue (nom marque/produit/…) · Mode (badge couleur) · Pays · Validité (du → au) · Source · Notes · Actions.
  - Tri par défaut : actifs d'abord, puis date de fin asc.
- Bouton **"Nouvelle règle"** → Sheet/Dialog :
  - Vendeur (Combobox sur `vendors_public`).
  - Scope (Select) → champ cible conditionnel :
    - `brand` → Combobox `brands`
    - `manufacturer` → Combobox `manufacturers`
    - `product` → Combobox `products`
    - `category` → Combobox `categories`
  - Mode (RadioGroup `showcase`/`hide`/`block`) + tooltip explicatif par mode.
  - `valid_from` (date, default = today) + `valid_until` (date, obligatoire).
  - `country_codes[]` (MultiSelect BE/FR/LU/NL/DE/…) — vide = tous.
  - `notes` (Textarea) + `source` (Input texte libre : contrat, mail, …).
  - Validations front : `valid_until > valid_from`, cible requise selon scope.
  - Submit = INSERT direct (RLS admin) — les triggers DB s'occupent du contrôle overlap (toast l'erreur Postgres `vendor_exclusivity_overlap` en clair).
- Édition : même Sheet en mode update (UPDATE).
- Actions ligne :
  - "Désactiver maintenant" (set `valid_until = now()`).
  - "Supprimer" (DELETE, confirmation).
  - "Dupliquer".

### Sidebar

- Ajouter une entrée **"Exclusivités vendeurs"** dans la section admin existante (à côté de RFQ / Prix cockpit) — icône `ShieldCheck`.

### Routing

- Ajouter route `/admin/exclusivites` dans `App.tsx` (lazy import, garde admin déjà en place sur le layout).

---

## Lot 3 — Consommation des vues côté front

L'objectif : que `mode='hide'` et `mode='block'` masquent l'offre, et que `mode='showcase'` mette un badge "Exclusivité <Vendeur>" sur la card / fiche produit (résolu côté front via `vendor_exclusivities` joinée à la vue + pays acheteur).

### Hook central

- `src/hooks/useEffectiveOffers.ts` (nouveau) : wrappe `effective_offer_prices_v` + jointure `vendor_exclusivities` via la vue `offers_with_exclusivity_v`. Renvoie `{ offers, showcaseByVendorId }` filtré par pays de l'acheteur (`useUserCountry`).
- Filtrage : `hide` et `block` → offre exclue du tableau renvoyé.
- `showcase` → offre conservée + flag `is_showcase: true` + `showcase_vendor_id`.

### Fichiers à patcher (front public uniquement)

1. **Fiche produit** `src/components/product/ProductOffersTable.tsx` (et `useProductOffers.ts`) :
   - Remplacer la lecture directe par `useEffectiveOffers`.
   - Si `is_showcase` sur la meilleure offre → badge "Exclusivité MediKong via <Vendeur anonymisé>" au-dessus du tableau.
2. **Catalog cards** `src/components/catalog/CatalogProductCard.tsx` + `TrivagoOfferRow.tsx` :
   - Idem : passer par le hook ; `hide`/`block` retirent l'offre du compteur de prix mini ; `showcase` ajoute un petit pictogramme `ShieldCheck` avec tooltip.
3. **Vue Trivago `/catalogue`** `src/pages/catalogue/...` :
   - Le hook `useCatalogProducts` lit déjà `products_with_country_stats_v`. **Ne pas refactor la MV** (hors scope). Le filtrage exclusivité s'applique uniquement sur le panneau "Offres" déplié (lazy). Les `country_*` agrégés peuvent rester légèrement sur-comptés pour cette V1 — à signaler dans la note de delivery, refacto MV dans un lot ultérieur.
4. **Recherche / fiche `/marques/:slug`** : pas de changement (les listes de produits ne dépendent pas des offres individuelles ici).

### Edge functions

- **Aucun changement** : les fonctions tournent en service_role et continuent à voir toutes les offres (volontaire — back-office, dispatch RFQ, etc. ne sont pas filtrés par exclusivité, c'est uniquement de la présentation acheteur).

---

## Hors scope (à proposer dans un lot 4 séparé si tu valides)

- Refacto de `products_with_country_stats_v` / `admin_price_cockpit_mv` pour intégrer les exclusivités dans les agrégats pays.
- UI côté vendeur ("Mes exclusivités" lecture seule dans portail vendeur).
- UI côté acheteur premium : page "Exclusivités du moment".
- Notifications vendeur quand une exclusivité expire dans <7j.

---

## Validation

- **Build** : `bunx tsc --noEmit` après chaque lot.
- **Lot 2** : créer manuellement 1 règle de chaque mode/scope via la nouvelle page, vérifier l'overlap (créer un doublon → toast d'erreur clair).
- **Lot 3** : avec les règles créées en Lot 2, charger une fiche produit affectée → vérifier masquage `hide`/`block` + badge `showcase`. Idem sur card catalogue.

---

## Question avant d'envoyer

Tu confirmes :
- l'ordre **Lot 2 puis Lot 3** dans la même réponse (je livre les deux d'un coup), et
- le **hors-scope assumé** (MV pays non refactorée → agrégats catalogue légèrement sur-comptés pour les produits sous exclusivité `hide`/`block`, seulement visible sur les chiffres "à partir de X €" du tri Trivago) ?
