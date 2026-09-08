-- lovable-cron-fallback-reviewed: 1440 runs/day; one-shot backfill of 117k rows that cannot complete in a single statement, job self-unschedules after drain (~25 runs, ~25 min)
CREATE OR REPLACE FUNCTION public.deactivate_redundant_legacy_qogita_offers(_limit integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH target AS (
    SELECT o.id, o.product_id
    FROM offers o JOIN vendors v ON v.id = o.vendor_id
    WHERE v.type = 'qogita' AND o.is_active = true
      AND EXISTS (
        SELECT 1 FROM offers o2 JOIN vendors v2 ON v2.id = o2.vendor_id
        WHERE o2.product_id = o.product_id AND v2.type = 'qogita_virtual' AND o2.is_active = true
      )
    LIMIT _limit
  ), upd AS (
    UPDATE offers o SET is_active = false, updated_at = now()
    FROM target t WHERE o.id = t.id
    RETURNING o.id, o.product_id
  ), ins AS (
    INSERT INTO offer_data_quality_logs (product_id, offer_id, issue_code, details)
    SELECT product_id, id, 'legacy_qogita_offer_deactivated',
           jsonb_build_object('reason', 'redondante, couverte par qogita_virtual', 'deactivated_at', now())
    FROM upd
    ON CONFLICT (product_id, offer_id, issue_code)
    DO UPDATE SET last_seen_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;

  IF v_count = 0 THEN
    PERFORM cron.unschedule('legacy-qogita-redundant-drain')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'legacy-qogita-redundant-drain');
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_redundant_legacy_qogita_offers(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_redundant_legacy_qogita_offers(integer) TO service_role;

SELECT cron.schedule(
  'legacy-qogita-redundant-drain',
  '* * * * *',
  $$SELECT public.deactivate_redundant_legacy_qogita_offers(5000);$$
);