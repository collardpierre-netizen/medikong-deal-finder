---
name: Vendor Exclusivities
description: Moteur DB + ciblage acheteurs/conditions pour les exclusivités vendeurs (marque/fabricant/produit/catégorie)
type: feature
---

## Lot 1a — Moteur DB (livré)
Table `vendor_exclusivities` (scope brand/manufacturer/product/category, mode showcase/hide/block, valid_from/until obligatoires, country_codes[]) + RPC `resolve_offer_exclusivity` cascade product>brand>mfr>category + triggers overlap & block (offers + external_offers) + cron horaire d'expiration.

## Lot 1b — Ciblage acheteurs + conditions (livré)
Colonnes ajoutées sur `vendor_exclusivities` :
- `buyer_profile_ids text[]` (NULL = tous profils ; sinon liste de `buyer_profiles.id`), index GIN.
- `min_revenue_cents bigint`, `min_volume_units integer`, `commitment_months integer` (1..600), `conditions_notes text` — tous nullable, CHECK ≥ 0.

RPC `resolve_offer_exclusivity(_product_id, _country, _buyer_profile_id text DEFAULT NULL)` :
- Filtre `buyer_profile_ids IS NULL OR _buyer_profile_id = ANY(buyer_profile_ids)`.
- Garde-fou : si visiteur anonyme (`_buyer_profile_id IS NULL`) ET exclu ciblée par profil ET mode ≠ showcase → mode coercé à `showcase` (préserve SEO public).
- Retour étendu : `applied_buyer_profile_id`.

Nouveaux helpers :
- `current_buyer_profile_id() returns text` SECURITY DEFINER — lit `profiles.buyer_profile_id` de `auth.uid()`.
- Vue `effective_offer_exclusivity_v` (security_invoker) — exclus actives + colonnes scope/conditions, consommée par Lot 3.

## Hors scope actuel
- **Lot 2** (UI admin `/admin/exclusivites`) : à venir.
- **Lot 3** (consumers catalogue / fiche produit / RFQ) : à venir.
- Facturation auto des engagements CA, alertes fin d'exclu, contractualisation PDF : Lot 4 à valider.
