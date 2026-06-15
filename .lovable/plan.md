# Plan — Multi-utilisateurs vendeur + langue portail vendeur

## Lot 1 — Admin : onglet "Utilisateurs & accès" dans fiche vendeur
**Fichier** : `src/pages/admin/AdminVendorDetail.tsx` (ou équivalent existant)
- Nouvel onglet **"Utilisateurs & accès"** affichant :
  - Le propriétaire (`vendors.auth_user_id`) avec badge "Propriétaire"
  - Liste des membres via `account_memberships` (scope=`vendor`, account_id=vendor.id) : email, rôle (`admin`/`member`/`viewer`), date d'ajout, dernière connexion
  - Liste des invitations en attente via `account_invitations` (statut=`pending`)
- Actions admin (via RPCs existants du système multi-user) :
  - **Inviter** (email + rôle) → crée invitation + envoie email
  - **Changer le rôle** d'un membre
  - **Révoquer** un membre ou une invitation
  - Garde-fou : impossible de retirer le dernier admin
- Composant réutilisable `AccountMembersPanel` (props : `accountId`, `scope`)

## Lot 2 — Portail vendeur : page "Équipe & accès"
**Fichier** : `src/pages/vendor/VendorSettingsTeamPage.tsx` (nouveau) + entrée dans la sidebar vendeur "Paramètres → Équipe & accès"
- Même composant `AccountMembersPanel` réutilisé, scopé sur `current_user_vendor_account_ids`
- Restrictions : seuls les membres `admin` du compte vendeur peuvent inviter/révoquer/changer rôles. Les `member`/`viewer` voient la liste en lecture seule.
- Bandeau d'explication des rôles (admin = tout, member = gestion offres/commandes, viewer = lecture seule)

## Lot 3 — Email d'invitation + page d'acceptation
- **Template email** : `supabase/functions/_shared/email-templates/account-invitation.tsx` (React Email, branding MediKong) — sujet "Vous êtes invité·e à rejoindre <vendor_name> sur MediKong"
- **Edge function** : `send-account-invitation` (déclenchée par la RPC d'invitation, idempotency key = token)
- **Page publique** : `/account/invitation/:token`
  - Affiche le compte cible, le rôle proposé, qui invite
  - Si non connecté → propose login/signup avec email pré-rempli
  - Si connecté avec un email différent → message explicite (l'invitation est liée à un email précis)
  - Bouton "Accepter" → appelle RPC `accept_account_invitation(token)` → redirige vers `/vendor` (ou `/compte` si scope buyer)
- Route ajoutée dans `App.tsx` (publique, noindex)

## Lot 4 — Langue sur le portail vendeur
- Monter le composant `<LanguageSelector />` (existant dans `src/components/LanguageSelector.tsx`) dans la **topbar du portail vendeur** (`src/components/vendor/VendorTopBar.tsx` ou équivalent)
- Vérifier que le contexte i18n (`src/i18n/index.ts`) est bien provider-wrappé au-dessus des routes `/vendor/*` (sinon ajouter)
- Persistance de la langue choisie : déjà gérée par `LanguageSelector` (localStorage + `profiles.preferences.locale` via `set_user_preference` si présent)

## Détails techniques

### RPCs supposés présents (mémoire `features/multi-user-accounts`)
- `invite_account_member(account_id, scope, email, role)` → renvoie token + crée ligne `account_invitations`
- `accept_account_invitation(token)` → crée ligne `account_memberships`, marque invitation `accepted`
- `revoke_account_member(membership_id)` / `revoke_account_invitation(invitation_id)`
- `update_account_member_role(membership_id, new_role)` (garde-fou dernier admin)
- Helpers `current_user_vendor_account_ids()` / `is_account_admin(account_id, scope)`

**À vérifier en lecture DB avant Lot 1** : noms exacts des RPCs et colonnes des tables `account_memberships` / `account_invitations`. Si manquants, je m'arrête et te le signale (zéro migration sans validation).

### Hors scope (à signaler, je ne touche pas)
- Fusion historique Pacheco / backfill des anciens vendeurs multi-user
- Extension RLS sur d'autres tables (offers, orders…) — la mémoire indique RLS additif uniquement sur `profiles` + `vendors` actuellement
- Traductions effectives des chaînes du portail vendeur (le `<LanguageSelector />` change la locale mais les `t('…')` doivent déjà exister côté i18n ; je ne traduis pas tous les écrans vendeur)

## Ordre de livraison
1. Lecture DB de vérification (RPCs + colonnes)
2. Lot 3 (template email + edge function + page publique d'acceptation) — pré-requis pour que l'invitation fonctionne de bout en bout
3. Lot 1 (admin) + Lot 2 (portail vendeur) — partagent le composant `AccountMembersPanel`
4. Lot 4 (langue portail vendeur) — indépendant, en parallèle si possible

Confirme-moi pour que je lance.
