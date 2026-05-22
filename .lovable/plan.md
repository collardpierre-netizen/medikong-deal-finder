# Garantie Satisfaction & Remboursement — acceptation vendeur obligatoire

## Objectif
Garantir contractuellement que tous les vendeurs MediKong adhèrent à la "Garantie satisfaction et remboursement" affichée côté acheteur (produits 100% authentiques, remboursement intégral, retour 14j, SAV). Acceptation versionnée, capturée au moment de l'onboarding/contrat. Vendeurs existants : considérés comme déjà acceptants (backfill silencieux, pas de re-prompt forcé maintenant).

## Modèle de données

### `marketplace_guarantee_versions`
Texte légal de la garantie, versionné, géré par admin.
- `version` (int unique, auto-incrémenté logiquement)
- `title`, `body_md` (markdown), `bullet_points` (text[]) — sourcés depuis le bloc déjà affiché en fiche produit
- `published_at` (NULL = brouillon)
- `is_current` (bool, unique partial index sur true)
- RLS : SELECT public sur versions `published_at IS NOT NULL`, ALL admin

### `vendor_guarantee_acceptances`
Trace immuable d'acceptation par vendeur × version.
- `vendor_id` (FK vendors)
- `guarantee_version_id` (FK marketplace_guarantee_versions)
- `accepted_at`, `accepted_by_user_id`, `ip`, `user_agent`
- `source` enum : `onboarding` / `backfill` / `admin_override`
- UNIQUE(vendor_id, guarantee_version_id)
- RLS : SELECT propre vendeur + admin ; INSERT via RPC dédiée

### Helpers SQL
- `current_guarantee_version_id()` — retourne l'id de la version `is_current`
- `vendor_has_accepted_current_guarantee(vendor_id)` — bool
- RPC `vendor_accept_guarantee(_version_id)` — insère acceptance avec auth.uid() comme `accepted_by_user_id`, ip/UA via headers, source='onboarding'

### Backfill
INSERT idempotent : pour chaque vendor existant (`accepted_at = vendor.created_at`, source='backfill') sur la v1.

## Frontend

### 1. Ajout étape "Garantie" dans `VendorOnboardingWizard.tsx`
Wizard passe de 4 → 5 étapes. Nouvelle **étape 4** (avant la confirmation finale, l'ancienne étape 4 devient étape 5) :
- Affiche le bloc complet (titre + bullets + body_md) lu depuis `marketplace_guarantee_versions` via hook `useCurrentGuarantee`
- Checkbox "J'ai lu et j'accepte la Garantie satisfaction et remboursement de MediKong"
- Bouton "Suivant" désactivé tant que la case n'est pas cochée
- Au passage à l'étape 5 : appel RPC `vendor_accept_guarantee(version_id)`

### 2. Page admin `/admin/guarantee`
- Liste des versions (current, brouillons, archivées)
- Éditeur (titre + bullets + body_md) avec preview live identique au bloc fiche produit
- Bouton "Publier comme version courante" (transactionnel : flip `is_current`)
- Onglet "Adhésions vendeurs" : liste vendor × version × date × source, filtre par version
- Export CSV des acceptations

### 3. Hook `useVendorGuaranteeStatus(vendorId)`
Retourne `{ hasAcceptedCurrent, currentVersion, lastAcceptance }`. Utilisé par le wizard et le bandeau optionnel (futur).

## Hors scope explicite (à valider plus tard si besoin)
- Pas de garde-fou DB sur `offers.is_active = true` (choix utilisateur : blocage en amont seulement à l'onboarding)
- Pas de bandeau bloquant pour les vendeurs déjà actifs (backfill = acceptée)
- Pas de re-prompt automatique sur publication d'une nouvelle version → la mécanique de "re-acceptation obligatoire" sera ajoutée dans un prompt séparé (l'infra versionnée est en place, il suffira d'activer le gate ; à ce jour le wizard ne re-prompte pas un vendeur déjà onboardé)
- Pas de modification du bloc côté acheteur (la card "Garantie satisfaction" sur ProductPage reste, mais sera ré-alimentée depuis la même table dans un prompt séparé pour single source of truth)

## Détails techniques

### Migration SQL (1 fichier)
- 2 tables + RLS + index unique partiel `is_current`
- 3 fonctions SQL (SECURITY DEFINER pour la RPC accept)
- Seed v1 avec le texte exact de la capture utilisateur, `is_current = true`
- Backfill INSERT...SELECT depuis vendors

### Fichiers frontend touchés
- `src/pages/vendor/VendorOnboardingWizard.tsx` — +1 étape, total devient 5
- nouveau `src/hooks/useGuarantee.ts` — hook lecture version courante + acceptance vendeur
- nouveau `src/pages/admin/AdminGuarantee.tsx` + route dans `App.tsx`
- nouveau `src/components/vendor/GuaranteeAcceptStep.tsx` (extrait pour test/réutilisation)

### Sécurité
- `vendor_accept_guarantee` valide que `auth.uid()` est bien `vendors.auth_user_id` du vendor visé
- Le texte affiché vendeur = exactement `body_md` + `bullet_points` de la version courante (pas de divergence avec l'admin)
- Acceptances jamais modifiables/supprimables hors super_admin (RLS UPDATE/DELETE = false sauf super_admin)

## Vérifications post-implémentation
1. `bunx tsc --noEmit`
2. Linter Supabase (RLS warnings)
3. Test manuel onboarding : impossible de cliquer Suivant sans cocher → coché → acceptance créée → étape 5 OK
4. Page admin `/admin/guarantee` : édition + publication v2 → vérifier qu'`is_current` bascule correctement, ancienne version reste consultable
5. Compter `vendor_guarantee_acceptances` après backfill = nombre de vendors existants (source='backfill')
