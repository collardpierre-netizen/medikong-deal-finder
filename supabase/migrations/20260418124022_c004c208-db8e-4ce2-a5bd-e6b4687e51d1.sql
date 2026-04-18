-- Archive old error sync logs and mark stuck running ones as failed
UPDATE public.sync_logs
SET stats = COALESCE(stats, '{}'::jsonb) || '{"archived": true}'::jsonb
WHERE status='error'
  AND completed_at < NOW() - INTERVAL '24 hours'
  AND NOT (COALESCE(stats, '{}'::jsonb) ? 'archived');

UPDATE public.sync_logs
SET status='error',
    completed_at=NOW(),
    error_message=COALESCE(error_message, 'Auto-marked as failed: stuck in running > 2h')
WHERE status='running'
  AND started_at < NOW() - INTERVAL '2 hours';

UPDATE public.sync_logs
SET status='error',
    completed_at=COALESCE(completed_at, NOW()),
    error_message=COALESCE(error_message, 'Multi-vendor partial run from 17/04 — manually closed')
WHERE status='partial'
  AND started_at < NOW() - INTERVAL '24 hours';