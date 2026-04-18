UPDATE public.sync_logs
SET status='error',
    completed_at=NOW(),
    error_message='Multi-vendor partial run from 17/04 — manually closed'
WHERE status='partial';