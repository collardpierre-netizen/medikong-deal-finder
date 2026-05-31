## Objectif

Page admin `/admin/contract-template` permettant d'éditer le mandat de facturation, bumper une nouvelle version, prévisualiser le PDF, et publier — sans toucher au code pour les évolutions futures.

## Architecture cible

Aujourd'hui le contenu (`CONTRACT_VERSION`, `MEDIKONG_DEFAULTS`, `CONTRACT_ARTICLES`) est hard-codé dans deux fichiers miroirs. Pour permettre l'édition admin, on déplace ce contenu **en DB** et on lit le miroir code uniquement en fallback de bootstrap (seed v1.0 si la table est vide).

## 1. DB — Table `contract_templates`

Nouvelle table (admin-only en écriture, lecture authentifiée) :

```text
id              uuid pk
contract_type   text  ('mandat_facturation')
version         text  ('v1.0', 'v1.1', …)  UNIQUE(contract_type,version)
status          text  ('draft' | 'published' | 'archived')
effective_at    timestamptz NULL    -- date d'entrée en vigueur (publication)
medikong_data   jsonb               -- MEDIKONG_DEFAULTS
articles        jsonb               -- CONTRACT_ARTICLES (même shape qu'aujourd'hui)
required_fields jsonb               -- REQUIRED_VENDOR_FIELDS
notes           text                -- commentaire interne de version
created_by      uuid (auth.users)
created_at, updated_at
```

Contraintes :
- Une seule ligne `published` par `contract_type` à la fois (trigger).
- Bump = INSERT d'une nouvelle ligne `draft`, copie du dernier published.
- Publish = `status='published'`, archive l'ancienne.

RPC `get_active_contract_template(_type)` → renvoie la ligne `published` courante (security definer, lecture publique).
RPC admin `bump_contract_template(_type, _new_version, _notes)` → clone last published en draft.
RPC admin `publish_contract_template(_id, _effective_at)`.

Seed initial : insert la v1.0 actuelle depuis le contenu du fichier code (one-shot dans la migration).

## 2. Lecture serveur

- `supabase/functions/_shared/contract-template.ts` : devient un fallback statique. Nouveau helper `loadActiveContractTemplate(supabase)` qui appelle la RPC ; en cas d'erreur, retombe sur les constantes en dur (pour ne pas casser la signature en cours).
- `generate-contract-pdf/index.ts` : utilise `loadActiveContractTemplate` au lieu d'importer directement les constantes. Le `CONTRACT_VERSION` stocké dans `contracts` provient désormais de la ligne DB.

## 3. Lecture client (vendeur)

- `src/lib/contract/mandat-facturation-template.ts` : pareil, devient fallback. Nouveau hook `useActiveContractTemplate()` (React Query) qui appelle la RPC.
- `VendorContractPage` consomme le hook au lieu des constantes (transition transparente).

## 4. Page admin `/admin/contract-template`

UI minimaliste (pas de WYSIWYG, pas de Tiptap — édition structurée JSON + textarea par paragraphe pour rester maintenable) :

- **Header** : version active, date d'effet, bouton "Nouvelle version (draft)" (saisie semver `v1.1`, `v2.0`…).
- **Sélecteur de version** (drafts + published + archived).
- **Form** :
  - Bloc "Coordonnées MediKong" (champs `MEDIKONG_DEFAULTS`).
  - Liste d'articles drag-and-drop (@dnd-kit, déjà au projet) :
    - Numéro, titre.
    - Paragraphes : texte simple, liste à puces, ou sous-article (3 boutons "Ajouter…").
    - Suppression article / paragraphe.
  - Champs requis vendeur (toggle par champ).
  - Textarea "Notes de version" (changelog interne).
- **Actions sur draft** :
  - "Enregistrer" (UPDATE jsonb).
  - "Prévisualiser PDF" : appelle `generate-contract-pdf` en mode `dry_run=true` avec `template_id` du draft + données vendeur fictives → renvoie PDF base64, ouvert dans nouvel onglet. *(extension légère de l'edge function existante)*.
  - "Publier" : confirm dialog (effet : archive l'ancienne, applique la nouvelle à toute signature future, vendeurs déjà signés restent sur leur version). Saisie `effective_at` (default = now).
- **Aperçu HTML inline** rendu via le même renderer que `VendorContractPage`.

## 5. Routing + sidebar

- `App.tsx` : `<Route path="contract-template" element={<AdminContractTemplate />} />` sous `/admin`.
- Lien dans la sidebar admin section "Légal / Vendeurs" (à côté de `contract-audit`).

## 6. Audit & sécurité

- `audit_logs` : INSERT à chaque bump / publish / preview avec `template_id`, `version`, `actor`.
- Toutes les RPC d'écriture : gated par `is_admin(auth.uid())` + `log_security_event('contract_template.*', …)`.

## Out of scope (à valider séparément si voulu)

- Édition WYSIWYG riche (gras/italique/liens).
- Diff visuel entre 2 versions.
- Notification email automatique aux vendeurs déjà signés lors d'une publication (l'article 10 prévoit "30 jours avant entrée en vigueur" — process manuel pour l'instant).
- Migration des vendeurs signés vers une nouvelle version (volontairement non-automatique : ils restent sur leur version signée jusqu'à re-signature).

## Livrables (5 fichiers + 1 migration)

1. Migration `contract_templates` + RPCs + seed v1.0.
2. `supabase/functions/_shared/contract-template-loader.ts` (helper DB+fallback).
3. Extension `generate-contract-pdf` : support `dry_run` + `template_id`.
4. `src/hooks/useActiveContractTemplate.ts`.
5. `src/pages/admin/AdminContractTemplate.tsx` + sous-composants éditeur.
6. Route + entrée sidebar admin.

Mémoire à mettre à jour : ajouter "Contract Template Editor" décrivant la nouvelle table + la chaîne de lecture.
