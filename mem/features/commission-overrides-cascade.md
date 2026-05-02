---
name: Commission overrides cascade
description: Cascade commission à 3 niveaux (offre > produit > vendeur) avec workflow d'approbation admin, override offre auto-service vendeur et audit
type: feature
---

## Cascade

`resolve_effective_commission(_offer_id uuid)` retourne `{source, model, rate, margin_split_pct, fixed_amount, valid_from, valid_until}` :

1. **`offer`** : `offers.commission_*` si `commission_override_status='approved'` et période valide (`commission_valid_from`/`commission_valid_until`).
2. **`product`** : `vendor_product_commissions(vendor_id, product_id)` UNIQUE, status='approved', période valide.
3. **`vendor`** : fallback `vendors.commission_*` (modèle/taux/split/fixe).

## Workflow

- **Override produit** : vendeur crée/modifie via `VendorCommissionOverrideDialog` → INSERT/UPDATE `vendor_product_commissions` avec `status='pending_approval'` (forcé par RLS pour le vendeur). Admin valide via RPC `admin_review_product_commission(_id, _decision, _reason)`.
- **Override offre** : vendeur soumet via `OfferCommissionOverrideDialog` → UPDATE direct sur `offers.commission_*` + `commission_override_status='pending_approval'`. Bouton "Retirer l'override" remet tous les champs à NULL. Admin valide via RPC `admin_review_offer_commission(_offer_id, _decision, _reason)`.
- Modèles supportés : `flat_percentage` (% sur PV), `margin_split` (part vendeur %), `fixed_amount` (€/u.).

## Audit

`commission_overrides_audit` (admin only, RLS) loggée par triggers :
- `trg_audit_vpc` (AFTER INSERT/UPDATE/DELETE sur `vendor_product_commissions`)
- `trg_audit_offer_commission` (BEFORE UPDATE sur `offers`, uniquement si champs commission changent — set aussi `commission_override_updated_by/at`)

## Front

- Hook `useEffectiveCommission(offerId)` → cache 60s, utilisé dans `MarginBreakdownDetails` (badge source + ligne dédiée) et les deux dialogs d'override.
- `VendorCommissionOverrideDialog` : override produit (vendor × product). Props `vendorId`, `productId`, `productName?`, `offerId?`, `trigger?`.
- `OfferCommissionOverrideDialog` : override offre. Props `offerId`, `productName?`, `trigger?`. Bouton "Retirer l'override" pour reset (tous les champs à NULL).
- Dans `VendorOffers.tsx` (table) : 2 boutons par ligne — `<Percent>` (jaune) override produit, `<Tag>` (orange) override offre avec point coloré indiquant le statut (vert=approved, ambre=pending).
- Page admin : `/admin/commission-overrides` — toggle scope `Overrides produit | Overrides offre` puis tabs statut (en attente/approuvées/rejetées/expirées).

## Périodes

`valid_from`/`valid_until` (produit) et `commission_valid_from`/`commission_valid_until` (offre) optionnels (campagnes). RPC ignore les overrides hors fenêtre → fallback automatique au niveau supérieur.
