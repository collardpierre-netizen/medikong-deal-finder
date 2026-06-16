
-- 1) Extend enums
ALTER TYPE public.qogita_resync_status ADD VALUE IF NOT EXISTS 'needs_review';
ALTER TYPE public.qogita_resync_status ADD VALUE IF NOT EXISTS 'skipped_guardrail';
ALTER TYPE public.qogita_resync_mode ADD VALUE IF NOT EXISTS 'reconciliation_sweep';
