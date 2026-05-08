
-- Backwards-compat columns for audit_logs to support callers using the
-- newer schema (actor_id / target_* / payload / entity_* / metadata).
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS target_type text,
  ADD COLUMN IF NOT EXISTS target_id uuid,
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Keep user_id mirrored from actor_id for legacy queries that still SELECT user_id.
CREATE OR REPLACE FUNCTION public.audit_logs_sync_actor()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.actor_id IS NOT NULL THEN
    NEW.user_id := NEW.actor_id;
  ELSIF NEW.actor_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.actor_id := NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_logs_sync_actor ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_sync_actor
  BEFORE INSERT OR UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_sync_actor();
