
## Contexte

Le tableau de bord vendeur affiche aujourd'hui 4 KPIs (CA du mois, Marge brute, Commandes, Offres actives) + optionnellement le prévisionnel. Manquent :

1. **CA en cours (graphique jour par jour)** — mois en cours
2. **Ventilation par profil client** (pharmacie, hôpital, cabinet, etc.)
3. **Marge nette** (marge brute − commission MediKong)
4. **Commission MediKong** (montant du mois)
5. **GMV du mois** (volume brut TTC)
6. **Barre de progression GMV** vers le prochain palier de commission négociée

Aucune modification d'une autre partie du dashboard ni de la logique métier existante.

## Ce que je vais faire

### 1. Nouveau hook `useVendorMonthlyDashboard(vendorId)`
- Charge les `order_lines` du vendeur du mois en cours (non-forecast, hors statuts exclus).
- Rejoint `sub_orders` (subtotal_incl_vat pour GMV) et `resolve_effective_commission` déjà utilisé côté back-office pour calculer la commission par ligne.
- Renvoie :
  - `gmvCents` (Σ line_total_incl_vat)
  - `revenueExclVatCents`, `grossMarginCents`
  - `commissionCents` (Σ commissions par ligne)
  - `netMarginCents = grossMarginCents − commissionCents`
  - `dailySeries: Array<{ day: string; revenueCents }>` (CA HTVA par jour, 1..fin de mois, 0 pour jours sans vente)
  - `commissionTier: { currentPct, nextPct, thresholdCents, progressPct }` lu depuis `vendor_commission_negotiated_tiers` (table à confirmer). Si aucune règle négociée : renvoie `null` → la jauge ne s'affiche pas.

### 2. Nouveau hook `useVendorCustomerTypeRevenue(vendorId, period="month")`
- Réutilise `useVendorSalesBreakdowns` existant mais en filtrant sur le mois courant et en calculant le **montant** par `customer_type` (au lieu du nombre de commandes actuellement affiché).

### 3. Nouveaux composants sous `src/components/vendor/dashboard/`
- `RevenueTrendCard.tsx` — courbe Recharts (AreaChart) du CA quotidien du mois.
- `CustomerTypeBreakdownCard.tsx` — barres horizontales par profil client avec montant + %.
- `MediKongCommissionCard.tsx` — 3 stats (Commission, Marge nette, GMV) + `CommissionTierProgress` (barre + libellé "1 250 EUR / 5 000 EUR avant palier 15 %").

### 4. Intégration dans `src/pages/vendor/VendorDashboard.tsx`
Ajout d'une nouvelle rangée sous la rangée KPI existante :
- Ligne 1 (existante, inchangée) : 4 VStat
- **Nouvelle ligne 2** : `MediKongCommissionCard` (3 stats + jauge palier)
- **Nouvelle ligne 3** : `RevenueTrendCard` (2/3) + `CustomerTypeBreakdownCard` (1/3)

## Questions à confirmer avant de coder

1. **Palier de commission négociée** — quelle est la source de vérité ? Une table `vendor_commission_negotiated_tiers` (à créer), un champ JSON sur `vendors`, ou les paliers viennent d'une constante hardcodée à définir avec toi ?
2. **GMV = TTC ou HTVA ?** Standard e-commerce = TTC (subtotal_incl_vat). Je pars sur TTC sauf indication contraire.
3. **Commission MediKong** : dois-je utiliser la RPC existante `resolve_effective_commission` par offre (précis mais N appels) ou est-ce qu'un champ `commission_amount_cents` est déjà stocké sur `order_lines` / `sub_orders` que je peux sommer directement ?

Je m'arrête ici pour validation avant d'écrire le code ou toute migration DB.
