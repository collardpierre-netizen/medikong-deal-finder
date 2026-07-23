
-- (a) Nettoyer les runs 'running' orphelins AVANT tout index unique
UPDATE public.sync_pipeline_runs
SET status = 'stale',
    completed_at = COALESCE(completed_at, now()),
    error_message = COALESCE(error_message, 'Auto-staled during concurrency lock migration')
WHERE status = 'running';

-- (b) Ajouter colonne heartbeat
ALTER TABLE public.sync_pipeline_runs
  ADD COLUMN IF NOT EXISTS last_progress_at timestamptz;

UPDATE public.sync_pipeline_runs
SET last_progress_at = COALESCE(last_progress_at, completed_at, started_at, created_at)
WHERE last_progress_at IS NULL;

-- (c) Index unique partiel : un seul run 'running' par pays (sans CONCURRENTLY)
CREATE UNIQUE INDEX IF NOT EXISTS sync_pipeline_runs_one_running_per_country
  ON public.sync_pipeline_runs (country_code)
  WHERE status = 'running';
