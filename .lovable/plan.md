## Objectif

Créer une page dédiée **`/vendor/analytics`** (accessible depuis la sidebar vendeur, remplace l'entrée "Analytics BIENTÔT") qui devient un vrai outil d'analyse des ventes MediKong, avec en plus un module de comparaison **sell-in (MediKong) vs sell-out (données remontées par les clients)**.

## Découpage en 3 lots livrables séparément

### Lot 1 — Analytics ventes MediKong (lecture seule, données déjà en base)

Une page unique en onglets :

**a) Vue d'ensemble**
- Bandeau KPIs période (30j / 90j / 12m / custom) :
  - CA HTVA, marge nette, commission MediKong
  - Nb commandes, panier moyen, nb clients actifs
  - Δ vs période précédente (flèche + %)
- Série journalière/hebdo/mensuelle (déjà existante, réutilisée)

**b) Typologie clients** (déjà partiellement dans "Ventation par profil")
- Répartition CA par profil (retail, pharmacie, MR/MRS, hôpital, vétérinaire, dentiste, cabinet)
- Répartition CA par pays (BE/FR/LU)
- Répartition CA par région (BE : provinces via `be_city_to_province` ; FR : régions ; LU : cantons)
- Top 10 clients par CA + part de portefeuille (% du CA total)

**c) Récurrence & fidélité**
- Cohortes acquisition mois par mois (heatmap rétention)
- % nouveaux vs récurrents sur la période
- Fréquence moyenne de commande par client (jours entre commandes)
- Clients à risque de churn : dernier achat > moyenne × 2

**d) Carte des clients**
- Carte interactive (leaflet + OpenStreetMap, pas de clé API)
- Cluster de points par code postal client
- Taille = CA, couleur = profil
- Popup au clic : nom pharmacie, CA période, dernière commande
- Toggle : bulles proportionnelles au % ventes par province

**e) Produits & offres**
- Top 20 SKU (CA, marge, unités)
- SKU en déclin (Δ négatif > 30% vs période précédente)
- Ruptures détectées (offres actives sans commande depuis 60j)

### Lot 2 — Sell-in vs Sell-out (nouveau module d'encodage)

Le vendeur encode le **sell-out** communiqué par ses clients pour comparer avec le **sell-in** enregistré sur MediKong.

**Modèle de données**
```
vendor_sell_out_reports
  vendor_id, customer_id (facultatif si client hors MediKong), customer_label,
  period_start, period_end, granularity (month/quarter),
  currency, source (manual/csv/api), created_by, notes

vendor_sell_out_lines
  report_id, product_id (nullable), gtin, cnk_code, external_ref,
  product_label, units_sold, gross_revenue_cents, net_revenue_cents
```
- RLS : lecture/écriture pour le vendor propriétaire + admin
- GRANT authenticated + service_role

**UI dans l'onglet "Sell-in vs Sell-out"**
- Bouton "Nouveau rapport sell-out" : sélection client (autocomplete customers MediKong ou saisie libre), période, upload XLSX/CSV avec colonnes `GTIN|CNK|Libellé|Unités|CA HTVA`
- Résolution auto GTIN/CNK → `product_id` MediKong via `product_market_codes`
- Tableau comparatif par produit :
  - Sell-in MediKong (unités, CA HTVA, dernière commande)
  - Sell-out client (unités, CA HTVA)
  - Δ unités, ratio sell-through (%), alerte si sell-out > sell-in (surstock ou fuite marché)
- Vue agrégée client : sell-in vs sell-out total, coefficient de rotation
- Export XLSX de la comparaison

### Lot 3 — Vue admin globale (facultatif, à confirmer)

Miroir de la page vendeur côté `/admin/analytics-vendeurs` avec filtre par vendeur, pour comparer les vendeurs entre eux. **Non couvert par ce plan** — à demander séparément.

## Détails techniques

**Nouveaux fichiers**
```
src/pages/vendor/VendorAnalyticsPage.tsx     (shell + tabs)
src/components/vendor/analytics/
  KpiRow.tsx
  TypologyBreakdown.tsx
  RecurrenceCohorts.tsx
  CustomerMap.tsx                             (react-leaflet)
  ProductPerformance.tsx
  SellInVsSellOut/
    ReportsList.tsx
    NewReportDialog.tsx
    ComparisonTable.tsx
    parseSellOutXlsx.ts
src/hooks/
  useVendorAnalyticsKpis.ts
  useVendorCustomerBreakdown.ts
  useVendorCustomerLocations.ts
  useVendorRecurrence.ts
  useVendorSellOutReports.ts
```

**Réutilisé**
- `useVendorMonthlyDashboard`, `useVendorSalesBreakdowns`, `useVendorGmvProgress`
- Recharts (déjà installé)
- Nouvelles deps : `react-leaflet` + `leaflet` + types + `xlsx` (déjà présent)

**Migrations SQL**
1. Vues `vendor_analytics_*_v` (security_invoker = true) pour KPIs, typologie, cohortes, geo
2. RPCs `vendor_analytics_kpis(_from, _to, _prev_from, _prev_to)`, `vendor_customer_locations(_from, _to)`, `vendor_recurrence_cohorts(_months)`
3. Tables `vendor_sell_out_reports` + `vendor_sell_out_lines` (RLS vendor-scoped + service_role, GRANT authenticated)
4. RPC `vendor_sell_in_vs_sell_out(_report_id)` qui joint sell-out lines avec `order_lines` MediKong sur produit + période

**Navigation**
- Sidebar vendeur : entrée "Analytics" (Lucide `BarChart3`), badge retiré
- Suppression du placeholder "BIENTÔT"

## Ordre de livraison proposé

1. **Lot 1a** (2 sprints d'itération) : shell page + KPIs + typologie + top clients + top produits (aucun package neuf)
2. **Lot 1b** : récurrence/cohortes + carte react-leaflet
3. **Lot 2** : tables + UI encodage + comparaison

Chaque lot est livré séparément et validé avant de passer au suivant, conformément à ta règle de scope strict.

## Questions pour toi avant de démarrer

1. **Périmètre du Lot 1** : on part sur les 5 blocs listés (KPIs / typologie / récurrence / carte / produits) ou tu veux qu'on démarre plus resserré (KPIs + typologie + carte seulement) ?
2. **Sell-out** : sources acceptées = manuel + upload XLSX/CSV suffisant pour V1 ? (API vendeur = plus tard)
3. **Carte** : react-leaflet + OpenStreetMap OK (gratuit, sans clé) ou tu préfères Mapbox ?
4. **Vue admin globale** (Lot 3) : je l'inclus dans ce chantier ou on la traite plus tard ?

Je n'écris pas une ligne de code tant que tu n'as pas validé le périmètre.
