---
name: Commission overrides cascade
description: Cascade commission à 3 niveaux (offre > produit > vendeur) avec workflow d'approbation admin et audit
type: feature
---

## Cascade

`resolve_effective_commission(_offer_id uuid)` retourne `{source, model, rate, margin_split_pct, fixed_amount, valid_from, valid_until}` :

1. **`offer`** : `offers.commission_*` si `commission_override_status='approved'` et période valide.
2. **`product`** : `vendor_product_commissions(vendor_id, product_id)` UNIQUE, status='approved', période valide.
3. **`vendor`** : fallback `vendors.commission_*` (modèle/taux/split/fixe).

## Workflow

- Vendeur crée/modifie via `VendorCommissionOverrideDialog` → INSERT/UPDATE `vendor_product_commissions` avec `status='pending_approval'` (forcé par RLS pour le vendeur).
- Admin valide depuis `/admin/commission-overrides` via RPC `admin_review_product_commission(_id, _decision, _reason)`.
- Modèles supportés : `flat_percentage` (% sur PV), `margin_split` (part vendeur %), `fixed_amount` (€/u.).

## Audit

`commission_overrides_audit` (admin only, RLS) loggée par triggers :
- `trg_audit_vpc` (AFTER INSERT/UPDATE/DELETE sur `vendor_product_commissions`)
- `trg_audit_offer_commission` (BEFORE UPDATE sur `offers`, uniquement si champs commission changent — set aussi `commission_override_updated_by/at`)

## Front

- Hook `useEffectiveCommission(offerId)` → cache 60s, à utiliser dans `MarginBreakdownDetails` et cockpit prix.
- `VendorCommissionOverrideDialog` : props `vendorId`, `productId`, `productName?`, `offerId?` (affiche cascade actuelle).
- Page admin : `/admin/commission-overrides` (tabs en attente/approuvées/rejetées/expirées, recherche vendeur/produit/GTIN).

## Périodes

`valid_from`/`valid_until` optionnels (campagnes). RPC ignore les overrides hors fenêtre → fallback automatique au niveau supérieur.
