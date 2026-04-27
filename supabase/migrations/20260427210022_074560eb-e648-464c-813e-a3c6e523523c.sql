-- Helper : enregistrer une erreur d'endpoint Qogita (incrémentale)
CREATE OR REPLACE FUNCTION public.record_qogita_endpoint_error(
  _log_id uuid,
  _endpoint text,
  _status integer DEFAULT NULL,
  _error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing jsonb;
  v_samples jsonb;
  v_count integer;
BEGIN
  IF _log_id IS NULL OR _endpoint IS NULL THEN RETURN; END IF;

  SELECT errors_by_endpoint -> _endpoint INTO v_existing
  FROM public.qogita_resync_logs WHERE id = _log_id FOR UPDATE;

  v_count := COALESCE((v_existing->>'count')::int, 0) + 1;
  v_samples := COALESCE(v_existing->'samples', '[]'::jsonb);

  -- Garde au max 5 échantillons
  v_samples := v_samples || jsonb_build_array(jsonb_build_object(
    'at', now(),
    'status', _status,
    'error', _error_message
  ));
  IF jsonb_array_length(v_samples) > 5 THEN
    v_samples := v_samples - 0;
  END IF;

  UPDATE public.qogita_resync_logs
  SET errors_by_endpoint = errors_by_endpoint || jsonb_build_object(
        _endpoint, jsonb_build_object(
          'count', v_count,
          'last_status', _status,
          'last_error', _error_message,
          'last_at', now(),
          'samples', v_samples
        )
      ),
      total_errors = total_errors + 1
  WHERE id = _log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_qogita_endpoint_error(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_qogita_endpoint_error(uuid, text, integer, text) TO service_role;

-- Helper : incrémenter les compteurs de progression
CREATE OR REPLACE FUNCTION public.record_qogita_resync_progress(
  _log_id uuid,
  _delta jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _log_id IS NULL THEN RETURN; END IF;

  UPDATE public.qogita_resync_logs
  SET products_processed = products_processed + COALESCE((_delta->>'products_processed')::int, 0),
      offers_processed   = offers_processed   + COALESCE((_delta->>'offers_processed')::int, 0),
      offers_updated     = offers_updated     + COALESCE((_delta->>'offers_updated')::int, 0),
      offers_created     = offers_created     + COALESCE((_delta->>'offers_created')::int, 0),
      offers_deactivated = offers_deactivated + COALESCE((_delta->>'offers_deactivated')::int, 0),
      tiers_synced       = tiers_synced       + COALESCE((_delta->>'tiers_synced')::int, 0)
  WHERE id = _log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_qogita_resync_progress(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_qogita_resync_progress(uuid, jsonb) TO service_role;