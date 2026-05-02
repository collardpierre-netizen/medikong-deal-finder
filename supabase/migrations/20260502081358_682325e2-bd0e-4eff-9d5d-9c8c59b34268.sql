-- Add assignee tracking + audit columns to anomaly resolution workflow
ALTER TABLE public.market_delta_anomalies
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_market_delta_anomalies_assigned_to
  ON public.market_delta_anomalies(assigned_to);

-- RPC to atomically update status / notes / assignee with audit fields
CREATE OR REPLACE FUNCTION public.update_market_delta_anomaly(
  _id uuid,
  _status text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _assigned_to uuid DEFAULT NULL,
  _clear_assignee boolean DEFAULT false
)
RETURNS public.market_delta_anomalies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.market_delta_anomalies;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT (public.is_admin(v_uid) OR public.is_super_admin(v_uid)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('open','reviewed','ignored','fixed') THEN
    RAISE EXCEPTION 'invalid status: %', _status;
  END IF;

  UPDATE public.market_delta_anomalies a
  SET
    status = COALESCE(_status, a.status),
    resolved_at = CASE
      WHEN _status IS NULL THEN a.resolved_at
      WHEN _status = 'open' THEN NULL
      ELSE now()
    END,
    resolved_by = CASE
      WHEN _status IS NULL THEN a.resolved_by
      WHEN _status = 'open' THEN NULL
      ELSE v_uid
    END,
    notes = CASE WHEN _notes IS NULL THEN a.notes ELSE NULLIF(_notes,'') END,
    notes_updated_at = CASE WHEN _notes IS NULL THEN a.notes_updated_at ELSE now() END,
    notes_updated_by = CASE WHEN _notes IS NULL THEN a.notes_updated_by ELSE v_uid END,
    assigned_to = CASE
      WHEN _clear_assignee THEN NULL
      WHEN _assigned_to IS NULL THEN a.assigned_to
      ELSE _assigned_to
    END,
    assigned_at = CASE
      WHEN _clear_assignee THEN NULL
      WHEN _assigned_to IS NULL THEN a.assigned_at
      WHEN _assigned_to IS DISTINCT FROM a.assigned_to THEN now()
      ELSE a.assigned_at
    END
  WHERE a.id = _id
  RETURNING a.* INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'anomaly not found: %', _id;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_market_delta_anomaly(uuid, text, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_market_delta_anomaly(uuid, text, text, uuid, boolean) TO authenticated, service_role;