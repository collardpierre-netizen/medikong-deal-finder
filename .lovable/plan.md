
# Exclusivités vendeur — Plan d'implémentation

## Décisions verrouillées (récap)
1. **Niveaux** : marque, fabricant *(bonus, même mécanique)*, produit, catégorie. Tous les niveaux supportés dès la phase 1, modèle unique.
2. **Mode** : mix `showcase` | `hide` | `block` (1 mode actif par exclusivité).
3. **RFQ** : non concerné — le routage RFQ ignore complètement la table.
4. **Périmètre offres** : s'applique aux offres MediKong vendeurs **et** aux offres externes (Qogita compris).
5. **Durée** : `valid_from` + `valid_until` **obligatoires** (date fin > date début, future).
6. **Visibilité acheteur** : assumée — badge "Exclusivité MediKong" + nom du vendeur exclusif quand pertinent.

---

## 1. Modèle de données

### Table `vendor_exclusivities`
| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `vendor_id` | uuid FK vendors | bénéficiaire de l'exclusivité |
| `scope` | enum `brand` / `manufacturer` / `product` / `category` | un seul renseigné selon scope |
| `brand_id` / `manufacturer_id` / `product_id` / `category_id` | uuid nullable | un seul non-null (check) |
| `mode` | enum `showcase` / `hide` / `block` | |
| `valid_from` | timestamptz NOT NULL | |
| `valid_until` | timestamptz NOT NULL | check > valid_from |
| `country_codes` | text[] nullable | NULL = tous pays ; sinon BE/FR/LU/NL |
| `reason` | text | interne admin |
| `contract_ref` | text | n° contrat/avenant |
| `is_active` | bool default true | kill switch manuel |
| `created_by` / `created_at` / `updated_at` | | |

**Index** : `(scope, brand_id)`, `(scope, product_id)`, `(valid_until)` partiel `is_active=true`.

**Contrainte d'unicité fonctionnelle** : une seule exclusivité **active+en cours** par (scope, target_id, country) — vérifiée par trigger (impossible en UNIQUE classique à cause des plages temporelles + array pays). Conflit → erreur claire.

### Modes
- `showcase` : les offres des autres vendeurs restent visibles mais grisées + badge "Exclusivité <vendeur>". L'acheteur peut quand même cliquer.
- `hide` : les offres concurrentes sont **filtrées** côté lecture (catalog, fiche produit, marque) ; non comptées dans `country_*_stats`.
- `block` : `hide` + interdiction côté backend pour les autres vendeurs de publier/mettre à jour une offre sur le scope concerné (trigger sur `offers` + `external_offers`).

---

## 2. Logique serveur

### RPC `resolve_offer_exclusivity(_offer_id uuid, _country text)` → record
Retourne `{ exclusive_vendor_id, mode, exclusivity_id }` ou null. Cascade :
1. product (le plus spécifique)
2. brand
3. manufacturer
4. category (le moins spécifique)

Le plus spécifique gagne ; à scope égal, la plus récente.

### Vue `effective_offers_v` (security_invoker)
Joint `offers` + `external_offers` (UNION via colonne `source`) avec la RPC ci-dessus pour exposer :
- `is_excluded_by_exclusivity` (bool) → utilisé par `hide`
- `is_showcase_dimmed` (bool) → utilisé par `showcase`
- `exclusive_vendor_id` / `exclusive_vendor_public_name`

**`useProductOffers`, `effective_offer_prices_v`, `products_with_country_stats_v` et la MV `admin_price_cockpit_mv`** consomment cette vue ⇒ filtrage natif pour `hide` ; flag transmis au front pour `showcase`.

### Trigger `block`
Sur INSERT/UPDATE de `offers` et `external_offers` : si une exclusivité active `mode='block'` cible le produit/marque/fabricant/catégorie pour un autre vendeur que celui inséré → `RAISE EXCEPTION`.

### Cron horaire
Désactivation auto des exclusivités où `valid_until < now()` (passe `is_active=false` + log `audit_logs`).

### RLS
- `vendor_exclusivities` : lecture admin + vendeur bénéficiaire ; écriture admin uniquement (phase 1).
- GRANT standard.

---

## 3. Impact sur les surfaces existantes

| Surface | Comportement |
|---|---|
| Fiche produit `/produit/:slug` | mode `hide` masque les autres offres ; `showcase` les grise + bandeau "Exclusivité \<vendeur>" ; `block` = idem hide |
| Catalogue grid + Trivago | filtre `hide` ; tri prix recalculé sans les offres exclues |
| Fiche marque `/marques/:slug` | si exclusivité brand en mode hide → seules les offres du vendeur exclusif s'affichent ; bandeau global "Marque distribuée exclusivement par \<vendeur> jusqu'au DD/MM/YYYY" |
| Admin Price Cockpit | MV regénérée en tenant compte du filtre ; chip "Exclu" sur produits sous exclusivité hide/block |
| Vendor portal (autre vendeur) | si tentative create/edit offre sur scope `block` → erreur explicite "Produit sous exclusivité jusqu'au …" |
| External Offers Import (Qogita inclus) | mêmes triggers ; lignes rejetées listées dans `external_offers_import_logs` |
| **RFQ** | aucun impact — `rfq_resolve_target_vendors` n'interroge pas la table |

---

## 4. UI

### Admin (`/admin/exclusivites`)
- Liste filtrable (scope, vendeur, mode, statut temporel : à venir / en cours / expirée).
- Formulaire création : vendor picker, scope (radio) + target picker (brand/product/manufacturer/category), mode, dates, pays, raison, contrat. Validation côté form + RPC.
- Détail : audit (créé par, conflits détectés, offres impactées count).
- Bouton "Désactiver" (soft, garde l'historique).
- Entrée sidebar "EXCLUSIVITÉS" (proche de Vendeurs).

### Vendeur
- Onglet "Exclusivités" en lecture seule dans son portail : liste de ses exclusivités actives + à venir + expirées (30 derniers jours).

### Acheteur (assumé public)
- Badge `<Crown className="…" />` "Exclusivité MediKong" sur cards/fiches concernées.
- Tooltip : "Distribué exclusivement par \<vendeur public name> jusqu'au DD/MM/YYYY".
- Mode `showcase` : badge + offres concurrentes grisées (opacity 0.5 + tag "non recommandé").

---

## 5. Détails techniques

- Anonymisation vendeur : passer par `getVendorPublicName` partout pour respecter la guardrail mémoire.
- Helper `useExclusivityForProduct(productId, country)` + `useExclusivityForBrand(brandId, country)` côté front.
- Mémoire à créer : `mem://features/vendor-exclusivities` (modèle, modes, surfaces impactées, exclusion explicite RFQ).
- i18n FR/NL/DE/EN sur badges, tooltips, formulaires.

---

## 6. Lots d'implémentation

**Lot 1 — Schéma & moteur (DB)**
- Migration `vendor_exclusivities` + enums + check + indexes + trigger unicité + trigger block + cron expiration.
- RPC `resolve_offer_exclusivity` + vue `effective_offers_v`.
- RLS + grants.
- Refacto consommateurs SQL (`effective_offer_prices_v`, `products_with_country_stats_v`, MV cockpit) pour appliquer `hide`.

**Lot 2 — Admin UI**
- Page `/admin/exclusivites` (liste + form + détail) + route + sidebar.
- Hooks `useExclusivities`, mutations CRUD.

**Lot 3 — Front acheteur**
- Helpers `useExclusivityFor*`.
- Intégration badge + grisage `showcase` sur CatalogProductCard, ProductPage, BrandPage.
- Bandeau marque exclusive.

**Lot 4 — Front vendeur**
- Onglet "Exclusivités" lecture seule.
- Message d'erreur explicite côté formulaire d'offre quand `block` rejette.

**Lot 5 — QA & mémoire**
- Test `rfq_routing_self_test` (vérifier que RFQ ignore bien).
- Test exclusivité produit hide → MV cockpit recalculée.
- Mémoire `mem://features/vendor-exclusivities`.

---

## Hors scope (à valider plus tard si besoin)
- Workflow de demande d'exclusivité côté vendeur (vendor self-service).
- Exclusivité par **profil acheteur** (B2B/B2C/pharmacie…).
- Tarification dynamique liée à l'exclusivité (commission ↑).
- Notification email auto au vendeur exclusif à l'activation/expiration.
- Reporting financier "valeur des exclusivités" (€ générés vs. seuil contractuel).

Valide ce plan (ou demande des ajustements) et j'enchaîne Lot 1.
