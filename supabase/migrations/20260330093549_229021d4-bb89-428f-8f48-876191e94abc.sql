ALTER TABLE public.sync_logs
ADD COLUMN IF NOT EXISTS progress_current integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_total integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_message text;