
-- 2) Add sync_run_id columns (nullable, rétro-compat)
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS last_sync_run_id uuid;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_sync_run_id uuid;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS last_sync_run_id uuid;

CREATE INDEX IF NOT EXISTS idx_offers_last_sync_run_id ON public.offers(last_sync_run_id) WHERE last_sync_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_last_sync_run_id ON public.products(last_sync_run_id) WHERE last_sync_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_last_sync_run_id ON public.vendors(last_sync_run_id) WHERE last_sync_run_id IS NOT NULL;

-- 3) Extend qogita_resync_logs with sweep fields
ALTER TABLE public.qogita_resync_logs
  ADD COLUMN IF NOT EXISTS sweep_type text,
  ADD COLUMN IF NOT EXISTS sync_run_id uuid,
  ADD COLUMN IF NOT EXISTS entities_deactivated jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS entities_spared jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS threshold_days integer;

CREATE INDEX IF NOT EXISTS idx_qogita_resync_logs_sweep_type ON public.qogita_resync_logs(sweep_type, started_at DESC) WHERE sweep_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qogita_resync_logs_sync_run_id ON public.qogita_resync_logs(sync_run_id) WHERE sync_run_id IS NOT NULL;
