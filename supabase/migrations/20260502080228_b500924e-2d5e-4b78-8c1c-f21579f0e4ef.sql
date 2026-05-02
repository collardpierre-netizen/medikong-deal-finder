-- Job quotidien : alerte interne quand des produits ont un pack_size incohérent
-- avec celui détecté par les références marché (external_offers)

CREATE OR REPLACE FUNCTION public.run_pack_mismatch_alert_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_mismatch int := 0;
  v_conflict int := 0;
  v_missing int := 0;
  v_top jsonb;
  v_message text;
BEGIN
  -- Lecture des incohérences depuis la vue d'audit existante
  WITH issues AS (
    SELECT *
    FROM public.product_pack_audit_v
    WHERE pack_resolution_status <> 'ok'
  ),
  agg AS (
    SELECT
      count(*) FILTER (WHERE TRUE) AS total,
      count(*) FILTER (WHERE pack_resolution_status = 'external_vs_product_mismatch') AS mismatch,
      count(*) FILTER (WHERE pack_resolution_status = 'external_conflict') AS conflict,
      count(*) FILTER (WHERE pack_resolution_status = 'missing_product_pack_size') AS missing
    FROM issues
  ),
  top20 AS (
    SELECT jsonb_agg(jsonb_build_object(
      'product_id', product_id,
      'name', product_name,
      'cnk', cnk_code,
      'pack_size', product_pack_size,
      'overrides', external_pack_overrides,
      'status', pack_resolution_status
    ) ORDER BY
      CASE pack_resolution_status
        WHEN 'external_vs_product_mismatch' THEN 1
        WHEN 'external_conflict' THEN 2
        WHEN 'missing_product_pack_size' THEN 3
        ELSE 4
      END,
      external_offers_count DESC NULLS LAST
    ) AS payload
    FROM (
      SELECT * FROM issues
      ORDER BY
        CASE pack_resolution_status
          WHEN 'external_vs_product_mismatch' THEN 1
          WHEN 'external_conflict' THEN 2
          WHEN 'missing_product_pack_size' THEN 3
          ELSE 4
        END,
        external_offers_count DESC NULLS LAST
      LIMIT 20
    ) s
  )
  SELECT agg.total, agg.mismatch, agg.conflict, agg.missing, top20.payload
  INTO v_total, v_mismatch, v_conflict, v_missing, v_top
  FROM agg, top20;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('status', 'ok', 'total_issues', 0);
  END IF;

  v_message := format(
    '%s produit(s) avec conditionnement incohérent (%s externe≠produit, %s conflits, %s pack manquant)',
    v_total, v_mismatch, v_conflict, v_missing
  );

  -- Notification admin globale (vendor_id NULL)
  INSERT INTO public.vendor_notifications (vendor_id, type, title, message, payload)
  VALUES (
    NULL,
    'pack_mismatch_alert',
    'Alerte conditionnements incohérents',
    v_message,
    jsonb_build_object(
      'total', v_total,
      'mismatch', v_mismatch,
      'conflict', v_conflict,
      'missing', v_missing,
      'top', v_top,
      'admin_url', '/admin/pack-audit'
    )
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'total_issues', v_total,
    'mismatch', v_mismatch,
    'conflict', v_conflict,
    'missing', v_missing
  );
END;
$$;

-- Cron quotidien 04:45 UTC (juste après le job market delta à 04:30)
SELECT cron.unschedule('pack-mismatch-alert-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pack-mismatch-alert-daily');

SELECT cron.schedule(
  'pack-mismatch-alert-daily',
  '45 4 * * *',
  $cron$ SELECT public.run_pack_mismatch_alert_job(); $cron$
);