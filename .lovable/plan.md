# Plan — Réconciliation Qogita (Sweeps A / B / C)

## Objectif
Garantir qu'aucun produit / offre / vendeur Qogita disparu ou en rupture ne reste commandable, sans risque de wipe massif.

---

## 1. Changements DB

### Nouvelles colonnes (ajoutées, jamais NOT NULL pour rester rétro-compat)
- `offers.last_sync_run_id uuid` + index partiel `WHERE source='qogita'`
- `products.last_sync_run_id uuid` (déjà `synced_at` présent)
- `vendors.last_sync_run_id uuid`
- `offer_price_tiers.last_sync_run_id uuid` (optionnel — pas strictement requis pour la désactivation, on s'appuie sur `offers`)

### Extension de `qogita_resync_logs`
- Ajouter `sweep_type text` (valeurs : `run_id`, `staleness`, `stock_zero`, `none`)
- Ajouter `sync_run_id uuid` (lien fort entre full run et son sweep A)
- Ajouter `entities_deactivated jsonb` : `{ offers, products, vendors }`
- Ajouter `entities_spared jsonb` : `{ offers, products, vendors, reason }`
- Étendre l'enum `qogita_resync_status` avec `needs_review` et `skipped_guardrail`
- Étendre l'enum `qogita_resync_mode` avec `reconciliation_sweep`

### Nouvelles RPCs (SECURITY DEFINER, service_role/admin only)
- `qogita_sweep_run_id(_sync_run_id uuid, _country text)` → désactive Qogita entities non touchées par ce run.
- `qogita_sweep_staleness(_threshold_days int default 7, _country text default null)` → désactive Qogita entities avec `synced_at < now() - threshold`.
- `qogita_deactivate_zero_stock_offers(_offer_ids uuid[])` → garde-fou immédiat, appelé par les fonctions sync.
- `qogita_reactivate_entity(_kind text, _id uuid, _reason text)` → réactivation manuelle admin, traçée dans audit_logs.

Chaque sweep applique en transaction :
1. Compte les candidats à désactiver vs total actifs Qogita.
2. **Garde-fou 1** : si `total_errors / offers_processed > 10%` sur le run lié → status `skipped_guardrail`, 0 désactivation.
3. **Garde-fou 2** : si `candidats > 20%` du total actif → status `needs_review`, 0 désactivation (log les IDs candidats dans `entities_spared.candidate_ids`).
4. Sinon : `UPDATE ... SET is_active=false [, stock_quantity=0]`.

### Règles de désactivation (sweeps A et B identiques)
- **Offres Qogita** (`offers WHERE source IN ('qogita') OR vendor.qogita_seller_alias IS NOT NULL`) → `is_active=false`, `stock_quantity=0`.
- **Produits Qogita-only** (`products.source='qogita'` ET aucune offre active restante) → `is_active=false`.
- **Vendeurs multi-vendor Qogita** (`vendors.qogita_seller_alias IS NOT NULL`) sans offre active → `is_active=false`.
- **Marques** : jamais.

### Réversibilité
Tous les upserts existants forcent déjà `is_active=true` quand une entité réapparaît dans un feed → la réversibilité est native, aucune logique supplémentaire.

### Confinement non-Qogita (sweep B)
Toutes les requêtes des sweeps filtrent strictement :
- `offers.source='qogita'` OU `offers.vendor_id IN (SELECT id FROM vendors WHERE qogita_seller_alias IS NOT NULL)`
- `products.source='qogita'`
- `vendors.qogita_seller_alias IS NOT NULL`
Aucun WHERE ne peut matcher une entité non-Qogita.

---

## 2. Cron jobs

| Cron | Quand | Action |
|---|---|---|
| Existant `run-sync-pipeline` mode=full (dim + mer 04:00 UTC) | inchangé | Génère `sync_run_id` → stampé par toutes les sous-functions → appelle sweep A à la fin |
| **Nouveau** `qogita-reconcile-daily` (tous les jours 05:00 UTC) | quotidien | Appelle sweep B (staleness 7j) |

Cron créé via `supabase--insert` (pg_cron + pg_net, contient anon key).

---

## 3. Edge functions

### Nouveau : `supabase/functions/qogita-reconcile/index.ts`
- Body : `{ sweep: 'run_id' | 'staleness', sync_run_id?: uuid, threshold_days?: number, country?: string, dry_run?: boolean }`
- Auth : service_role uniquement (verify_jwt = false + check service role header en interne).
- Appelle la RPC correspondante, retourne le récap.

### Modifications existantes
- `run-sync-pipeline` : génère `sync_run_id = crypto.randomUUID()` au début du mode `full`, le passe en param à `sync-qogita-products`, `sync-qogita-brands`, `sync-qogita-offers-detail`. Ajoute une étape finale `reconcile_sweep_a` qui appelle `qogita-reconcile`.
- `sync-qogita-products`, `sync-qogita-offers-detail`, `sync-qogita-brands` : acceptent `sync_run_id`, le persistent dans `last_sync_run_id` au moment de l'upsert (uniquement si fourni — incrémental → null).
- `sync-qogita-offers-detail` : sweep C — toute ligne renvoyée avec `stock=0` est immédiatement désactivée (déjà partiellement le cas via upsert ; on s'assure que `is_active=false` est explicitement set au lieu de juste `stock_quantity=0`).

---

## 4. UI Admin `/admin/sync`

Nouvelle section **"Réconciliation Qogita"** (sous l'historique pipeline existant) :
- Tableau : 50 derniers `qogita_resync_logs` avec `sweep_type IS NOT NULL` → date, type sweep, status (badge couleur), désactivés (offres/produits/vendeurs), épargnés, durée.
- Si `status='needs_review'` : bouton "Voir les candidats" (drawer affichant les IDs depuis `entities_spared.candidate_ids`) + bouton "Approuver la désactivation".
- Onglet "Réactivation manuelle" : champ ID + type (offer/product/vendor) → appelle `qogita_reactivate_entity`.

---

## 5. Tests & validation

- Test SQL : insérer offre Qogita avec `synced_at = now() - 10 days`, lancer sweep B → vérifier désactivation.
- Test garde-fou : forcer >20% candidats → vérifier `needs_review` + 0 modif.
- Test confinement : créer offre non-Qogita stale → vérifier qu'elle reste active après sweep B.
- Test réversibilité : désactiver via sweep, ré-upsert avec `is_active=true` → vérifier activation.

---

## Confirmations demandées avant code

✅ **Réversibilité** : garantie par les upserts existants qui forcent `is_active=true` à chaque réapparition (aucun code supplémentaire requis).

✅ **Sweep B ne touche jamais aux entités non-Qogita** : tous les WHERE sont gardés par `source='qogita'` ou `qogita_seller_alias IS NOT NULL`. Aucun fallback NULL.

✅ **Tables touchées** :
- Ajouts colonnes : `offers.last_sync_run_id`, `products.last_sync_run_id`, `vendors.last_sync_run_id`
- Extension : `qogita_resync_logs` (3 colonnes + 2 enums étendus)
- Aucune table supprimée, aucune colonne renommée.

✅ **Nouveau cron** : `qogita-reconcile-daily` (05:00 UTC chaque jour) appelant l'edge function `qogita-reconcile` en mode `staleness`.

Si OK, j'implémente la migration + l'edge function + le branchement dans `run-sync-pipeline` + l'UI admin + l'entrée cron.
