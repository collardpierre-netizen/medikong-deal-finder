# Verrou de concurrence Qogita — Plan révisé (v2)

Feedback intégré : heartbeat (pas started_at), migration non-transactionnelle safe, auto-exclusion du run courant.

## 1. Migration SQL (une seule transaction, sans CONCURRENTLY)

```sql
-- (a) Nettoyer les runs 'running' orphelins AVANT tout index unique
UPDATE public.sync_pipeline_runs
SET status = 'stale',
    completed_at = COALESCE(completed_at, now()),
    error_message = COALESCE(error_message, 'Auto-staled during concurrency lock migration')
WHERE status = 'running';

-- (b) Ajouter heartbeat pour staleness robuste (Full sync peut dépasser 15 min)
ALTER TABLE public.sync_pipeline_runs
  ADD COLUMN IF NOT EXISTS last_progress_at timestamptz;

UPDATE public.sync_pipeline_runs
SET last_progress_at = COALESCE(last_progress_at, completed_at, started_at)
WHERE last_progress_at IS NULL;

-- (c) Élargir l'enum de statut si CHECK constraint existe
-- (à adapter : soit DROP+ADD CHECK, soit rien si colonne text libre)
-- superseded / stale / skipped / completed_with_errors doivent être acceptés.

-- (d) Index unique partiel : un seul run 'running' par pays
-- PAS de CONCURRENTLY (bloque en migration transactionnelle Supabase).
-- Table petite, lock négligeable.
CREATE UNIQUE INDEX IF NOT EXISTS sync_pipeline_runs_one_running_per_country
  ON public.sync_pipeline_runs (country_code)
  WHERE status = 'running';
```

## 2. Edge function `run-sync-pipeline`

**Staleness basée sur heartbeat, pas sur started_at :**

- Constante `PIPELINE_HEARTBEAT_STALE_MINUTES = 15` (temps sans progression, robuste quelle que soit la durée totale du Full sync).
- Chaque étape (offers, offers-detail, recalc prix, meilisearch) bump `last_progress_at = now()` en début et fin.
- Aussi `started_at` mis à jour côté insert initial ; `last_progress_at` = `started_at` à l'insert.

**Flow au démarrage d'un run :**

1. Chercher run actif : `SELECT ... WHERE country_code = ? AND status = 'running'`.
2. Si trouvé :
   - `EXTRACT(EPOCH FROM (now() - last_progress_at))/60 < 15` → **skipped** : renvoyer `HTTP 200 { skipped: true, active_run_id, minutes_since_progress }` sans rien insérer.
   - Sinon → marquer ce run `stale` (pas failed) avec `error_message = 'No progress for N min'`.
3. INSERT du nouveau run en `running`, `last_progress_at = now()`.
4. Catch `23505` (unique_violation) → race condition, retourner `HTTP 200 { skipped: true, reason: 'race' }`.
5. `markPreviousRunsAsSuperseded(country, currentRunId)` : `UPDATE ... SET status='superseded' WHERE country_code=? AND status='running' AND id <> currentRunId` — **exclusion explicite du run courant** (point 4 du feedback).

**Bumper le heartbeat :** helper `bumpProgress(runId, stepName)` appelé au début et fin de chaque étape, met à jour `last_progress_at` + `current_step`.

## 3. Mapping des statuts (inchangé, validé)

- `running` — actif
- `completed` — vert, tout OK
- `completed_with_errors` — orange, au moins une étape en échec (déjà géré étape 4 précédente)
- `superseded` — gris neutre, supplanté par un run plus récent (jamais rouge)
- `stale` — gris neutre, pas de progression > 15 min, auto-nettoyé
- `skipped` — n'insère plus de ligne (retour immédiat sans row) ; pas de bruit dans l'historique
- `failed` — rouge, échec réel avec message

## 4. UI `AdminSync.tsx`

- Bouton "Relancer" désactivé si un run `running` existe pour le pays, tooltip "Un run est déjà en cours (démarré il y a X min, dernière progression il y a Y min)".
- Réponse `{ skipped: true }` → toast neutre "Run ignoré : déjà en cours".
- Badges historique :
  - `superseded` / `stale` → badge gris `bg-muted text-muted-foreground` avec label "Supplanté" / "Interrompu (sans progression)"
  - `completed_with_errors` → badge orange
  - `failed` → badge rouge (comportement inchangé)

## 5. Garde-fous préservés (aucune régression)

- Fix self-invocation edge→edge (`functions.invoke`) — non touché.
- Sweeps A/B/C — non touchés.
- Cron stale-refresh, mute detection — non touchés.
- Balooh vendor, connexion Qogita — non touchés.
- Étape 4 Meilisearch (fix précédent) — non touchée.

## Notes techniques

- Heartbeat rend `PIPELINE_STALE_MINUTES` (15 min) valide pour Full ET incrémental : c'est le temps sans progression, pas la durée totale. Un Full de 45 min qui progresse toutes les 2 min reste `running`.
- Migration non-transactionnelle évitée : pas de `CONCURRENTLY`, table petite (< quelques milliers de lignes), lock ACCESS EXCLUSIVE bref sur CREATE INDEX standard.
- `id <> currentRunId` protège contre l'auto-supersede si markPreviousRunsAsSuperseded est appelé après l'INSERT.

Confirme et j'applique la migration + les 3 edits (`run-sync-pipeline/index.ts`, helpers heartbeat dans les étapes qui bumpent, `AdminSync.tsx`).
