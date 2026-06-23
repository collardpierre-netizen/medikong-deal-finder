## Objectif

Uniformiser sur les pages **admin (Dashboard, Finances, Commissions, Stripe, Analytics, Commandes manuelles, Litiges, Logistique, Onboarding, Reconciliation)** et **vendor (Dashboard, Orders, Finance, Billing, InvoicePayments, Logistics, Analytics)** :

1. **Statuts commandes / sub-commandes** : libellés, couleurs et filtres cohérents avec `/admin/commandes`
2. **Affichage des montants en €** : séparateurs de milliers + 2 décimales partout, même format

Aucune modification de logique métier, RPC, schéma DB ou autres pages que celles listées.

---

## Référentiel cible (source de vérité)

Statut commande (table `orders.status`) — déjà câblé dans `StatusBadge` :

| clé DB        | libellé FR    | couleur dot |
|---------------|---------------|-------------|
| `pending`     | En attente    | ambre       |
| `confirmed`   | Confirmée     | vert        |
| `processing`  | En cours      | bleu        |
| `shipped`     | Expédié       | violet      |
| `delivered`   | Livré         | vert        |
| `cancelled`   | Annulé        | rouge       |

Filtres tabs commandes (clé `statusFilters` dans `/admin/commandes`) → réplique identique partout où une liste de commandes est filtrée par statut.

Formatage € (helper unique déjà utilisé `fmt = n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` → suffixé par ` EUR` ou `&nbsp;€`). Plus aucun `${n} EUR` brut, plus aucun `Math.round(n)` pour des montants.

---

## Périmètre & travaux par page

### Admin

- **AdminDashboard** — vérifier les KPI cards (GMV, panier moyen, commissions) → passer par `fmt`. StatusBadge déjà OK.
- **AdminFinances** — montants encaissés / à encaisser / commissions / balance vendeurs : `fmt`. Statuts de paiement → mapping uniforme (`paid`, `pending`, `overdue`).
- **AdminCommissions** + **AdminCommissionOverridesPage** — colonnes montant & taux → `fmt` ; statut override = badge cohérent.
- **AdminStripeRevenue / AdminQogitaConnection (Stripe section)** — montants Stripe en cents → conversion + `fmt`. Statuts transferts (`paid`, `pending`, `failed`).
- **AdminAnalytics** — chiffres KPI (GMV, AOV, commission) → `fmt`. Aucun statut.
- **AdminCommandeManuelle** — totaux ligne / panier → `fmt` (déjà partiellement fait).
- **AdminCommandesEnRetard** + **AdminLitiges** + **AdminReconciliation** — colonnes montant + statut commande → référentiel cible.
- **AdminOnboarding** — statuts vendeur (KYC `pending_review` / `accepted` / `approved` / `rejected`) : libellés normalisés via un mini-map dédié (pas mélangé aux statuts commandes).
- **AdminLogistique** — statuts expédition (`pending` / `shipped` / `in_transit` / `delivered` / `returned`) : map dédiée, mêmes couleurs que ci-dessus.

### Vendor

- **VendorDashboard / VendorAnalytics** — KPI € → `fmt`.
- **VendorOrders** — filtres + badge statut = référentiel cible.
- **VendorFinance / VendorBilling / VendorInvoicePayments / VendorInvoicesToCollect** — montants € → `fmt` ; statuts facture (`paid` / `pending` / `overdue`) cohérents.
- **VendorLogistics / VendorShipments / VendorShipmentDetail** — statuts expédition (map livraison ci-dessus).

---

## Approche technique

1. **Centraliser le helper de format €** dans `src/lib/format-currency.ts` (export `fmtEur(n)` qui retourne `"1 234,56"`), réutilisé par toutes les pages. Ne casse rien : le `fmt` local actuel reste comportementalement identique.
2. **Étendre `StatusBadge`** (`src/components/admin/StatusBadge.tsx`) avec un nouveau preset `orderStatusMap` exportable (clés DB → libellé), ré-utilisé par les pages admin + vendor au lieu de redéfinir leurs propres maps. Aucun changement visuel du badge en lui-même.
3. **Onglets de filtres commandes** : extraire `ORDER_STATUS_FILTERS` (déjà ajouté implicitement dans `/admin/commandes`) dans `src/lib/order-status.ts` et l'importer dans VendorOrders / autres listes.
4. Faire les remplacements page par page : `${n} EUR` → `${fmtEur(n)} EUR`, `Math.round(...)` montants → `fmtEur`, badges custom → `<StatusBadge status={...} />`, listes de filtres → import partagé.
5. Pages non listées (Marques, Produits, Catégories, etc.) : **non touchées**.

---

## Vérifications

- `bunx tsgo --noEmit` à la fin (typecheck).
- Captures avant/après pour : AdminDashboard, AdminFinances, AdminCommissions, VendorOrders, VendorFinance.
- Rapport écrit listant exactement les fichiers modifiés et chaque remplacement, sans toucher à autre chose (respect du scope strict).

---

## Hors scope (à confirmer si tu veux l'inclure plus tard)

- Statuts RFQ, KYC, paiement Stripe, abonnements vendeurs → **non touchés** dans ce passage, car ils ont leur propre cycle de vie. Dis-moi si tu veux que je les inclue aussi.
- Pages publiques acheteur (`/compte/commandes`, etc.) → non touchées sauf demande explicite.
- Aucun changement DB / RPC / edge function.
