# Dashboard Commissions MediKong

Périmètre validé : Marketplace (%), Trading (100% marge), ventes manuelles ET online. Vues : par vendeur, par mois, par statut de facturation, par type. Cycle facturation complet.

## Phasage proposé (livrable en 3 lots — livrer lot 1+2 dans ce tour, lot 3 dans un tour dédié)

---

### 🅰️ Lot 1 — Fondations DB & vue matérialisée (ce tour)

**Nouvelle table `commission_invoices`** (facture commission MediKong émise vers vendeur, ou auto-consommée pour trading)
- Champs métier : `vendor_id`, `period_start`, `period_end`, `type` enum (`marketplace` | `trading`), `sales_channel` enum (`manual` | `online` | `mixed`), `orders_count`, `lines_count`, `gmv_incl_vat_cents`, `revenue_excl_vat_cents`, `commission_excl_vat_cents`, `vat_rate`, `vat_cents`, `total_incl_vat_cents`, `status` enum (`draft` | `to_invoice` | `invoiced` | `paid` | `disputed` | `cancelled`), `invoice_number`, `invoiced_at`, `due_date`, `paid_at`, `payment_reference`, `dispute_reason`, `notes`, `created_by`
- Table de liaison `commission_invoice_lines(commission_invoice_id, order_line_id, order_id, gmv_incl_vat_cents, revenue_excl_vat_cents, commission_excl_vat_cents, commission_basis, commission_rate)` — 1 ligne par order_line facturée, empêche le double-comptage via UNIQUE(order_line_id, type)
- RLS : admin only + service_role. GRANTs standard.
- Trigger `updated_at`.

**Vue `admin_commission_backlog_v` (security_invoker)** — TOUTES les order_lines facturables (statuts alignés `isBillableStatus`) NON encore rattachées à une `commission_invoice_lines`, enrichies avec :
- `vendor_id`, `vendor_display_name`, `order_id`, `order_number`, `order_created_at`, `order_status`, `payment_status`
- `sales_channel` (manual si `orders.is_manual = true`, sinon online)
- `commission_basis` ('margin' = trading | 'ca' = marketplace) via `sub_orders`/order_lines
- `commission_excl_vat_cents`, `revenue_excl_vat_cents`, `gmv_incl_vat_cents`
- `age_days` depuis livraison, `period_month` (YYYY-MM)

**RPCs admin :**
- `admin_commission_dashboard_kpis(_period_start, _period_end)` → { à_facturer, facturé, payé, en_litige } × { trading, marketplace } × { manuel, online }
- `admin_commission_by_vendor(_period_start, _period_end, _status?, _type?, _channel?)` → agrégats par vendeur avec drill-down commandes
- `admin_commission_by_month(_from, _to, _type?)` → série mensuelle
- `admin_create_commission_invoice(_vendor_id, _period_start, _period_end, _type, _order_line_ids[])` → crée `commission_invoices` + `commission_invoice_lines` en une transaction, status = `to_invoice`
- `admin_mark_commission_invoiced(_invoice_id, _invoice_number, _due_date)` / `admin_mark_commission_paid(_invoice_id, _payment_reference)` / `admin_mark_commission_disputed(_invoice_id, _reason)` / `admin_cancel_commission_invoice(_invoice_id)`

---

### 🅱️ Lot 2 — Page `/admin/commissions` (ce tour)

**Route** : `/admin/commissions` (item sidebar dans section "FINANCES")

**Structure** :
1. **Barre filtres** : période (défaut : mois courant), type (Trading/Marketplace/Tous), canal (Manuel/Online/Tous), vendeur (autocomplete)
2. **Row 1 — 5 KPI cards** : À facturer · Facturé · Payé · En litige · Total période (avec split Trading/Marketplace en tooltip via composant `CommissionBasisSplitCard` déjà créé)
3. **Row 2 — 2 graphs** :
   - `CommissionMonthlyChart` : timeline 12 mois glissants, stacked bar Trading vs Marketplace
   - `CommissionStatusPieChart` : répartition par statut de facturation
4. **Row 3 — Onglets** :
   - **Par vendeur** : table (vendeur | commandes | GMV | commission trading | commission marketplace | commission totale | à facturer | dernière facture) triable + bouton "Générer facture" par ligne
   - **Par mois** : table périodique
   - **Factures émises** : table `commission_invoices` filtrable + actions (marquer factuée/payée/en litige, télécharger, annuler)
   - **Backlog** : lignes non facturées, sélection multiple → bouton "Créer facture commission"
5. **Actions globales** : Export CSV, "Générer factures mensuelles auto" (bouton qui lance Lot 3)

**Composants** :
- `AdminCommissionsPage.tsx`
- `CommissionKpiRow.tsx`
- `CommissionMonthlyChart.tsx` (Recharts)
- `CommissionByVendorTable.tsx`
- `CommissionInvoicesTable.tsx`
- `CommissionBacklogTable.tsx` (sélection multi + modale création)
- `CreateCommissionInvoiceDialog.tsx`

---

### 🅲 Lot 3 — Génération auto + PDF + emails (tour suivant, à valider séparément)

- Edge function `generate-monthly-commission-invoices` (cron 1er du mois)
- Génération PDF facture commission (miroir du template `mandat-facturation`)
- Envoi email vendeur avec facture
- Écran vendeur `/vendor/commissions` : voir ses propres factures commission (read-only)
- Intégration Peppol si opt-in vendeur
- Reminders J+7/J+30 pour factures impayées

---

## Impacts techniques
- **Aucune modif business logic existante** : le calcul commission reste dans `computeCommissionFromLines` / `useVendorCommissionConfig`. Le dashboard n'est qu'une **lecture agrégée** + tracking facturation.
- **Idempotence** : `commission_invoice_lines.UNIQUE(order_line_id, type)` empêche de facturer deux fois la même ligne.
- **Corrections rétro** : si une commande passe en `cancelled` après facturation, ligne apparaît dans "En litige" via RPC de reconciliation (à ajouter Lot 3).
- **Trading** : les lignes trading génèrent des `commission_invoices` de type `trading` — pas facturées au vendeur (c'est du revenu direct MediKong), mais permettent le suivi comptable homogène.

## Points à confirmer avant que je code
1. **Numérotation facture commission** : format `CMSN-YYYYMM-NNNN` par vendeur ? Ou séquence globale ?
2. **Périodicité par défaut** : mensuelle (1er au dernier jour) ? Ou hebdomadaire ?
3. **Trading en facture** : je crée bien des `commission_invoices` type=trading pour le suivi interne, ou je les exclus du modèle facture (juste KPI/reporting) ?
4. **TVA sur commission** : 21% BE par défaut appliqué sur `commission_excl_vat_cents` ?

Réponds à ces 4 points → je lance Lot 1+2 immédiatement.
