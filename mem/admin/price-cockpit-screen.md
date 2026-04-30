---
name: Admin Price Cockpit
description: Page /admin/prix-cockpit avec onglets "Offres à challenger" (RPC admin_price_cockpit_rows + worst_action_score) et "Trous catalogue" enrichi (RPC admin_price_cockpit_gaps_v2 : produits actifs sans offre MK, signaux de demande RFQ 90j + popularité + offres externes + priority_score). Filtres : pays, recherche, RFQ minimum, "uniquement avec demande". Tris : priorité / RFQ / popularité / nom. Action "Challenger le vendeur" via PriceChallengeModal.
type: feature
---

## Vue d'ensemble

Page `/admin/prix-cockpit` — `src/pages/admin/AdminPriceCockpitPage.tsx`.

KPIs globaux : MK plus cher qu'externe / interne, produits actifs sans offre, écart moyen, total actifs.

## Onglet "Offres à challenger"
- RPC `admin_price_cockpit_rows`
- Tri : `worst_action_score` (défaut), `delta_external`, `delta_internal`
- Colonne Score (badge destructive ≥50, secondary ≥20, outline)
- Actions : Envoi rapide / Personnaliser via `PriceChallengeModal`

## Onglet "Trous catalogue" (enrichi)
- **RPC** : `admin_price_cockpit_gaps_v2(_country, _brand_id, _search, _min_rfq_count, _only_with_demand, _limit)` — admin only
- **Critère** : `products.is_active = true` AND aucune `offers.is_active = true` (filtré par pays)
- **Signaux de demande** :
  - `rfq_count_90d` : nb de RFQ ciblant ce produit sur 90j (filtré par pays acheteur si _country)
  - `rfq_total_qty_90d` : somme `rfqs.quantity`
  - `last_rfq_at` : MAX(`rfqs.created_at`)
  - `popularity` : `products.popularity`
  - `external_offers_count`, `external_best_ht` depuis `external_offers` actives
- **priority_score** : `RFQ_count × 10 + min(popularity, 100) × 0.5 + 5 (si dispo externe) + 15 (si RFQ < 14j)`
- **Filtres UI** : recherche, RFQ min, toggle "uniquement avec demande" (défaut ON)
- **Tris** : priorité / RFQ count / popularité / nom

## Action "Challenger le vendeur"
Cf. [Vendor Price Challenge](mem://features/vendor-price-challenge-action) — notification `vendor_notifications` + email transactionnel `vendor-price-challenge` + log `vendor_price_challenges` via RPC `admin_log_price_challenge`.
