# Multi-users par compte (acheteur / vendeur) + switch d'espace

## Objectif
Permettre à plusieurs utilisateurs auth de partager le même compte acheteur et/ou le même compte vendeur, avec 2 rôles (admin / member), invitation par email **ou** code, et switch d'espace pour un user lié aux deux côtés. Plus migration ciblée Pacheco ↔ PACHECO SA.

## Modèle de données (migration)

### 1. Table `account_memberships` (lien N-N entre user et compte)
- `user_id uuid` → auth.users
- `account_kind text check ('buyer','vendor')`
- `account_id uuid` → soit `profiles.id` (kind=buyer) soit `vendors.id` (kind=vendor)
- `role text check ('admin','member')` default 'member'
- `status text check ('active','invited','revoked')` default 'active'
- `invited_email text` (nullable)
- `invited_by uuid`, `accepted_at timestamptz`
- UNIQUE (user_id, account_kind, account_id)
- INDEX (account_kind, account_id) ; (user_id)

### 2. Table `account_invitations`
- `id`, `account_kind`, `account_id`, `email`, `role`, `token_hash` (sha256 du magic-link), `join_code` (6 chars, unique partiel), `expires_at` (default now()+14j), `created_by`, `accepted_by`, `accepted_at`, `revoked_at`
- INDEX (token_hash) ; INDEX (join_code where revoked_at is null and accepted_at is null)

### 3. Backfill historique
- Pour chaque `profiles.user_id IS NOT NULL` : INSERT membership(buyer, profile.id, role=admin)
- Pour chaque `vendors.auth_user_id IS NOT NULL` : INSERT membership(vendor, vendor.id, role=admin)
- Garantit qu'aucun compte existant ne perd l'accès.

### 4. Helpers SECURITY DEFINER (anti-récursion RLS)
- `current_user_buyer_ids() returns setof uuid` → tous les profiles dont l'user est membre actif
- `current_user_vendor_ids() returns setof uuid` → idem côté vendors
- `is_account_admin(_kind, _account_id) returns boolean`
- `current_vendor_id()` (déjà existant via vendors.auth_user_id) → on étend pour fallback sur membership active la plus récente / espace actif (cf. §6).

### 5. Mise à jour RLS (sans toucher aux helpers eux-mêmes)
On remplace les filtres `auth.uid() = user_id` (côté profiles) et `vendors.auth_user_id = auth.uid()` par `EXISTS (membership active)` pour tables liées :
- `profiles` (SELECT/UPDATE pour membres ; DELETE réservé admin)
- `vendors` (idem)
- Toutes les tables filtrant via `current_vendor_id()` héritent automatiquement (offers, vendor_notifications, vendor_catalog_interests, etc.)
- Tables acheteur sensibles : `orders`, `cart_items`, `rfqs`, `rfq_buyer_balances`, `rfq_credit_ledger`, `price_alerts`, `watch_list`, `buyer_comparator_sourcing_items` → SELECT/INSERT/UPDATE accessibles à tout membre actif du compte ; DELETE réservé admin pour les objets critiques (balances, sourcing).

NOTE: changement RLS strictement aligné sur la nouvelle notion de "compte" — pas de fix opportuniste ailleurs.

## Flux d'invitation

### Côté admin (page `/compte/equipe` pour acheteur, `/vendor/settings/equipe` pour vendeur)
- Liste des membres + statut + rôle (changement admin↔member par admin uniquement, jamais retirer le dernier admin).
- Bouton "Inviter par email" → RPC `account_invite_by_email(_kind, _account_id, _email, _role)` qui crée invitation + envoie email transactionnel (template `account-invitation`) avec lien `/rejoindre?token=...`.
- Bouton "Générer un code de jonction" → RPC `account_create_join_code(...)` retourne code 6 chars affiché à l'admin.
- Action "Révoquer" sur invitation ou membre.

### Côté invité
- Page publique `/rejoindre` accepte `?token=` (email) **ou** champ code manuel.
- Si non connecté : signup/login standard puis redirection sur le même `/rejoindre` (token persisté en sessionStorage).
- RPC `account_accept_invitation(_token, _join_code)` :
  - valide expiry/revoked, vérifie email si token (email match obligatoire),
  - crée membership active,
  - marque invitation accepted_by/accepted_at.
- Toast + redirection vers l'espace du compte (acheteur ou vendeur).

## Switch d'espace
- Nouveau hook `useAccountSpaces()` → liste { kind, account_id, label, role }.
- Composant `AccountSwitcher` dans le header utilisateur (visible uniquement si l'user a ≥ 2 espaces ou 1 espace + opposé).
- Espace actif persistant : `localStorage` + RPC `set_user_preference('active_account', {kind, id})`.
- `current_vendor_id()` lit la prefs si présente ET valide via membership, sinon fallback ancien comportement (vendors.auth_user_id).
- Côté acheteur : le contexte panier/RFQ lit `active_buyer_profile_id` provenant des prefs avec même garde-fou.

## Cas Pacheco / PACHECO SA (script ponctuel)
Étape séparée, exécutée APRÈS validation manuelle du couple cible :
1. Choisir le profil canonique (à confirmer par toi : lequel garde, Pacheco ou PACHECO SA ?).
2. Script SQL one-shot dans une migration dédiée (à valider) :
   - Réassigner les rows orders/rfqs/cart_items/price_alerts/watch_list/sourcing du profil "secondaire" vers le profil "canonique".
   - Créer `account_memberships` pour les 2 user_id sur le profil canonique (role=admin).
   - Désactiver (soft) le profil secondaire (status='merged_into:<canonical_id>').
3. **Je n'exécute PAS automatiquement** : je prépare le script et te demande confirmation.

## Fichiers à créer / modifier

### Migrations
- `multi_user_accounts_schema.sql` : tables + helpers + RLS + backfill.

### Edge function
- `account-invitation` transactional email (template + send via `send-transactional-email`).

### Frontend
- `src/hooks/useAccountMembers.ts`, `useAccountInvitations.ts`, `useAccountSpaces.ts`.
- `src/components/account/AccountMembersPanel.tsx` (réutilisé côté buyer & vendor settings).
- `src/components/account/AccountSwitcher.tsx` monté dans le header user (existant).
- `src/pages/JoinAccountPage.tsx` route `/rejoindre`.
- Patch léger `current_vendor_id` resolver côté hooks vendeur (`useVendorId`) pour lire la prefs.

### Hors-scope (signalé, pas touché)
- Pas de notifications push membres
- Pas de logs d'audit dédiés (audit_logs continue de logger qui fait quoi)
- Pas de quotas (nombre max de membres)
- Pas de SSO/SAML par compte
- Pas de modification des emails transactionnels existants
- Fusion Pacheco = étape séparée à valider après livraison de la mécanique

## Ordre d'exécution proposé
1. Migration schéma + backfill + RLS → **demande d'approbation explicite**.
2. Edge function email d'invitation.
3. Pages UI (équipe + /rejoindre + switcher).
4. Hooks vendor/buyer pour respecter l'espace actif.
5. Script de fusion Pacheco — **pause + ta validation cible avant exécution**.

Réponds par "go étape 1" pour lancer la migration, ou indique ce que tu veux ajuster.
