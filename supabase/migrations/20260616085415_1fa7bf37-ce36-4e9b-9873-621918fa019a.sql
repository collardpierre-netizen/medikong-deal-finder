ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS last_sync_run_id uuid;
CREATE INDEX IF NOT EXISTS idx_brands_last_sync_run_id ON public.brands(last_sync_run_id) WHERE last_sync_run_id IS NOT NULL;
