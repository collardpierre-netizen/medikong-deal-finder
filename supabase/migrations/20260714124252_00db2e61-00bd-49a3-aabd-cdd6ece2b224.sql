CREATE OR REPLACE FUNCTION public.admin_vendor_fanout_status(
  _days integer DEFAULT 7,
  _limit integer DEFAULT 200
)
RETURNS TABLE (
  order_id uuid,
  order_number text,
  paid_at timestamptz,
  payment_status text,
  order_status text,
  total_incl_vat numeric,
  expected_vendors integer,
  sub_orders_count integer,
  missing_vendors integer,
  email_attempts integer,
  emails_sent integer,
  emails_failed integer,
  last_attempt_at timestamptz,
  last_error text,
  last_error_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH paid AS (
    SELECT o.id, o.order_number, o.created_at AS paid_at,
           o.payment_status, o.status AS order_status, o.total_incl_vat
    FROM public.orders o
    WHERE o.payment_status = 'paid'
      AND o.created_at >= now() - make_interval(days => _days)
    ORDER BY o.created_at DESC
    LIMIT _limit
  ),
  expected AS (
    SELECT ol.order_id, COUNT(DISTINCT ol.vendor_id)::int AS n
    FROM public.order_lines ol
    WHERE ol.order_id IN (SELECT id FROM paid)
      AND ol.vendor_id IS NOT NULL
    GROUP BY ol.order_id
  ),
  subs AS (
    SELECT so.order_id, COUNT(*)::int AS n,
           array_agg(so.id) AS sub_ids
    FROM public.sub_orders so
    WHERE so.order_id IN (SELECT id FROM paid)
    GROUP BY so.order_id
  ),
  mails AS (
    SELECT
      (l.metadata->>'order_id')::uuid AS order_id,
      COUNT(*)::int AS attempts,
      COUNT(*) FILTER (WHERE l.status = 'sent')::int AS sent_count,
      COUNT(*) FILTER (WHERE l.status IN ('failed','bounced','dlq'))::int AS failed_count,
      MAX(l.created_at) AS last_at,
      (ARRAY_AGG(l.error_message ORDER BY l.created_at DESC)
        FILTER (WHERE l.status IN ('failed','bounced','dlq') AND l.error_message IS NOT NULL))[1] AS last_err,
      MAX(l.created_at) FILTER (WHERE l.status IN ('failed','bounced','dlq')) AS last_err_at
    FROM public.email_send_log l
    WHERE l.template_name = 'vendor-new-order'
      AND l.created_at >= now() - make_interval(days => _days + 1)
      AND (l.metadata->>'order_id')::uuid IN (SELECT id FROM paid)
    GROUP BY (l.metadata->>'order_id')::uuid
  )
  SELECT
    p.id,
    p.order_number,
    p.paid_at,
    p.payment_status,
    p.order_status,
    p.total_incl_vat,
    COALESCE(e.n, 0)                                    AS expected_vendors,
    COALESCE(s.n, 0)                                    AS sub_orders_count,
    GREATEST(COALESCE(e.n, 0) - COALESCE(s.n, 0), 0)    AS missing_vendors,
    COALESCE(m.attempts, 0)                             AS email_attempts,
    COALESCE(m.sent_count, 0)                           AS emails_sent,
    COALESCE(m.failed_count, 0)                         AS emails_failed,
    m.last_at                                           AS last_attempt_at,
    m.last_err                                          AS last_error,
    m.last_err_at                                       AS last_error_at
  FROM paid p
  LEFT JOIN expected e ON e.order_id = p.id
  LEFT JOIN subs s     ON s.order_id = p.id
  LEFT JOIN mails m    ON m.order_id = p.id
  ORDER BY p.paid_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_vendor_fanout_status(integer, integer) TO authenticated;