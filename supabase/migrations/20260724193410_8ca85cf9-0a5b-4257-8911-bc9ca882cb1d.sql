-- 1) Add 'storefront' to the qogita_resync_mode enum so storefront runs are journaled.
ALTER TYPE public.qogita_resync_mode ADD VALUE IF NOT EXISTS 'storefront';

-- 2) Stop the dead loop: unschedule the tier-based fast-refresh crons that call
--    the deprecated Qogita offers API and pollute logs with ~100 errors per run.
DO $$
BEGIN
  PERFORM cron.unschedule('qogita-fast-refresh-tier-a');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('qogita-fast-refresh-tier-b');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('qogita-fast-refresh-tier-c');
EXCEPTION WHEN OTHERS THEN NULL; END $$;