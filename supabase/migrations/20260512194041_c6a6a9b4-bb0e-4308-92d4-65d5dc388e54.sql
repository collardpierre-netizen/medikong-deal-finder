
CREATE OR REPLACE FUNCTION public.admin_email_deliverability_kpis()
RETURNS TABLE (
  window_days int,
  total bigint,
  sent bigint,
  failed bigint,
  bounced bigint,
  complained bigint,
  suppressed bigint,
  success_rate numeric,
  bounce_rate numeric,
  complaint_rate numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (message_id) message_id, status, created_at
    FROM public.email_send_log
    WHERE message_id IS NOT NULL
      AND created_at >= now() - interval '30 days'
    ORDER BY message_id, created_at DESC
  ),
  windows AS (
    SELECT 7 AS d UNION ALL SELECT 30
  ),
  agg AS (
    SELECT
      w.d,
      count(*) FILTER (WHERE l.created_at >= now() - (w.d || ' days')::interval) AS total,
      count(*) FILTER (WHERE l.status = 'sent'       AND l.created_at >= now() - (w.d || ' days')::interval) AS sent,
      count(*) FILTER (WHERE l.status IN ('failed','dlq') AND l.created_at >= now() - (w.d || ' days')::interval) AS failed,
      count(*) FILTER (WHERE l.status = 'bounced'    AND l.created_at >= now() - (w.d || ' days')::interval) AS bounced,
      count(*) FILTER (WHERE l.status = 'complained' AND l.created_at >= now() - (w.d || ' days')::interval) AS complained,
      count(*) FILTER (WHERE l.status = 'suppressed' AND l.created_at >= now() - (w.d || ' days')::interval) AS suppressed
    FROM windows w
    LEFT JOIN latest l ON true
    GROUP BY w.d
  )
  SELECT
    a.d,
    a.total, a.sent, a.failed, a.bounced, a.complained, a.suppressed,
    CASE WHEN a.total > 0 THEN round(100.0 * a.sent       / a.total, 2) ELSE 0 END,
    CASE WHEN a.total > 0 THEN round(100.0 * a.bounced    / a.total, 2) ELSE 0 END,
    CASE WHEN a.total > 0 THEN round(100.0 * a.complained / a.total, 2) ELSE 0 END
  FROM agg a
  ORDER BY a.d;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_email_deliverability_kpis() TO authenticated;
