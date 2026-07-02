CREATE OR REPLACE FUNCTION public.admin_finalize_orphan_qogita_resync_logs(_stale_minutes int DEFAULT 30)
RETURNS TABLE(finalized_id uuid, new_status text, products_processed int, minutes_stuck int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF _stale_minutes IS NULL OR _stale_minutes < 1 THEN
    RAISE EXCEPTION 'invalid_stale_minutes' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY SELECT * FROM public.finalize_orphan_qogita_resync_logs(_stale_minutes);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_finalize_orphan_qogita_resync_logs(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_finalize_orphan_qogita_resync_logs(int) TO authenticated;