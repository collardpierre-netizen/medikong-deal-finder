CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.cleanup_qogita_master_catchall_batch()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := (SELECT id FROM public.vendors WHERE slug='qogita' AND type='qogita_virtual');
  v_rows int;
BEGIN
  UPDATE public.offers SET is_active=false, admin_hidden=true
  WHERE id IN (
    SELECT id FROM public.offers
    WHERE vendor_id = v_id AND is_active = true
    LIMIT 5000
  );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    PERFORM cron.unschedule('cleanup-qogita-master-catchall');
  END IF;
  RETURN v_rows;
END;
$$;

SELECT cron.schedule(
  'cleanup-qogita-master-catchall',
  '* * * * *',
  $$SELECT public.cleanup_qogita_master_catchall_batch();$$
);