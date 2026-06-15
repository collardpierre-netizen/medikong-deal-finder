# MOV/MOQ par compte acheteur — Plan d'implémentation

## Objectif
Ajouter un niveau de granularité supplémentaire dans la cascade MOV/MOQ : **override par compte acheteur précis** (vendor × buyer), qui prime sur le défaut profil × pays.

## Cascade finale (du plus prioritaire au moins prioritaire)
1. **Nouveau** : `vendor_buyer_overrides` (vendor_id × buyer_account_id) — override explicite par client final
2. `offer_buyer_profile_prices.min_order_value_cents` (par offre × profil) — existant
3. `vendor_profile_defaults` (vendor × profil × pays) — existant
4. `vendor_commercial_settings.default_mov` (MOV global vendeur) — existant
5. Fallback global `DEFAULT_MOV = 500 €` — existant

## 1. Base de données (migration)

Nouvelle table `vendor_buyer_overrides` :
- `vendor_id` (FK vendors)
- `buyer_account_id` (FK customers — c'est l'entité buyer/account utilisée partout)
- `default_mov` (numeric, nullable — null = pas d'override MOV)
- `default_moq` (integer, nullable — null = pas d'override MOQ)
- `notes` (text, nullable — raison commerciale, ex. "Contrat 2026 grand compte")
- `is_active` (boolean default true)
- `created_at`, `updated_at`, `created_by`
- UNIQUE (vendor_id, buyer_account_id) WHERE is_active

RLS :
- `admins manage all` (via `is_admin()`)
- `vendor can view/manage own` (vendor_id = current_vendor_id())
- pas de lecture acheteur direct (résolution serveur uniquement)

GRANTs : `authenticated` (SELECT/INSERT/UPDATE/DELETE) + `service_role` (ALL).

Trigger `updated_at`.

## 2. Résolution serveur

Étendre `supabase/functions/_shared/validate-cart.ts` :
- Récupérer `buyer_account_id` depuis l'utilisateur authentifié (table `customers` via `auth_user_id`)
- Charger les `vendor_buyer_overrides` actifs pour les vendors présents dans le panier × ce buyer
- Dans la cascade `movRequired`, **prioriser l'override buyer** s'il existe avant les autres niveaux

## 3. Front cart (`useVendorMov.ts`)

Étendre la cascade côté client (même priorité) pour l'affichage UI cohérent :
- Charger `vendor_buyer_overrides` pour les `vendorIds` × `customer.id`
- Si override existe → retourne `override.default_mov`
- Sinon → cascade actuelle

## 4. UI admin

Ajouter un **4ᵉ onglet "Par acheteur"** dans `AdminVendorMovMoqModal.tsx` :
- Tableau des overrides existants pour ce vendor
- Picker buyer (recherche par nom/email/n° client) pour ajouter une nouvelle ligne
- Édition inline MOV / MOQ / notes / actif
- Bouton suppression

Pas de UI côté vendeur ni acheteur en V1 (admin-only). Mention possible plus tard côté portail vendeur si besoin.

## 5. Hors scope (à valider plus tard)
- UI portail vendeur pour gérer ses propres overrides buyer
- Application de l'override MOQ par ligne d'offre (V1 : MOV uniquement appliqué au niveau vendor agrégé, MOQ reste au niveau offre — l'override MOQ buyer remplacerait le MOQ par défaut de chaque offre de ce vendor pour ce buyer ; à confirmer)
- Tracking audit (journal des changements de seuils)
- Période de validité (`valid_from` / `valid_until`)

## Question avant implémentation
**L'override MOQ par buyer doit-il s'appliquer à toutes les offres du vendor (remplace MOQ de chaque offre) ou seulement comme MOQ "agrégé" minimum sur l'ensemble ?** Par défaut je partirais sur **"remplace MOQ de chaque offre vers le bas uniquement"** (le buyer privilégié peut commander moins que le MOQ standard, jamais plus).
