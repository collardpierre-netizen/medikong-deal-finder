---
name: Admin Price Cockpit
description: Cockpit prix admin /admin/prix-cockpit pour analyser les écarts de prix et challenger les vendeurs (style Booking)
type: feature
---
Page admin **/admin/prix-cockpit** : tableau de bord transverse pour identifier où MediKong est moins compétitif et challenger les vendeurs.

**Backend (migration 2026-04-30) :**
- Table `vendor_price_challenges` (raison, ref/mk price HT, delta_pct, message, notification_id, sent_by, responded_at) — RLS admin all + vendor read own.
- RPC `admin_price_cockpit_rows(_country, _brand_id, _category_id, _min_delta_pct, _only_mk_higher, _limit, _offset)` : 1 ligne/produit avec MK best, MK 2e, externe best, marché (pharm/grossiste/public), PVP, deltas et `worst_action_score` (max écart % vs toutes refs).
- RPC `admin_price_cockpit_kpis(_country)` : compteurs (mk_higher_than_external, mk_higher_internal, active_products_total, active_products_without_offer, avg_delta_vs_external_pct).
- RPC `admin_price_cockpit_gaps(_country, _brand_id, _limit)` : produits actifs sans aucune offre MK.
- RPC `admin_log_price_challenge(...)` : journalise un challenge envoyé.

**Frontend :**
- Page `src/pages/admin/AdminPriceCockpitPage.tsx` : KPIs + onglet "Offres à challenger" (filtre pays/écart min/recherche) + onglet "Trous catalogue".
- Modal `src/components/admin/PriceChallengeModal.tsx` : 2 modes (envoi rapide template figé OU édition message). Crée `vendor_notifications` (type=`price_challenge`, cta_url=`/vendor/offers?product=...`) puis appelle `admin_log_price_challenge`. Suggestion auto : -1% sous la meilleure référence.
- Route ajoutée dans `src/App.tsx` sous `/admin/prix-cockpit`.
- Lien sidebar admin (icône TrendingDown) dans le groupe "intelligence", au-dessus de Veille prix.

**Logique de référence pour le challenge :** la référence la moins chère parmi {externe best, 2e MK, prix pharmacien marché} est sélectionnée automatiquement.
