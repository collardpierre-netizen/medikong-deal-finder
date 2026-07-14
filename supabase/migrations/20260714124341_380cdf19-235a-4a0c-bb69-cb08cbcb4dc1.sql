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
    SELECT so.order_id, COUNT(*)::int AS n
    FROM public.sub_orders so
    WHERE so.order_id IN (SELECT id FROM paid)
    GROUP BY so.order_id
  ),
  -- Emails vendeurs par commande : on relie via l'email destinataire
  -- (les emails vendor-new-order sont envoyés à contact_email/shipping_email/email
  -- du vendeur de la sub_order). Fenêtre : à partir de la date de paiement.
  vendor_emails AS (
    SELECT DISTINCT
      p.id AS order_id,
      LOWER(COALESCE(v.contact_email, v.shipping_email, v.email)) AS email
    FROM paid p
    JOIN public.sub_orders so ON so.order_id = p.id
    JOIN public.vendors v ON v.id = so.vendor_id
    WHERE COALESCE(v.contact_email, v.shipping_email, v.email) IS NOT NULL
  ),
  mails AS (
    SELECT
      ve.order_id,
      COUNT(*)::int AS attempts,
      COUNT(*) FILTER (WHERE l.status = 'sent')::int AS sent_count,
      COUNT(*) FILTER (WHERE l.status IN ('failed','bounced','dlq'))::int AS failed_count,
      MAX(l.created_at) AS last_at,
      (ARRAY_AGG(l.error_message ORDER BY l.created_at DESC)
        FILTER (WHERE l.status IN ('failed','bounced','dlq') AND l.error_message IS NOT NULL))[1] AS last_err,
      MAX(l.created_at) FILTER (WHERE l.status IN ('failed','bounced','dlq')) AS last_err_at
    FROM vendor_emails ve
    JOIN public.email_send_log l
      ON l.template_name = 'vendor-new-order'
     AND LOWER(l.recipient_email) = ve.email
     AND l.created_at >= (SELECT paid_at FROM paid WHERE id = ve.order_id) - interval '1 hour'
     AND l.created_at <= (SELECT paid_at FROM paid WHERE id = ve.order_id) + interval '30 days'
    GROUP BY ve.order_id
  )
  SELECT
    p.id,
    p.order_number,
    p.paid_at,
    p.payment_status,
    p.order_status,
    p.total_incl_vat,
    COALESCE(e.n, 0),
    COALESCE(s.n, 0),
    GREATEST(COALESCE(e.n, 0) - COALESCE(s.n, 0), 0),
    COALESCE(m.attempts, 0),
    COALESCE(m.sent_count, 0),
    COALESCE(m.failed_count, 0),
    m.last_at,
    m.last_err,
    m.last_err_at
  FROM paid p
  LEFT JOIN expected e ON e.order_id = p.id
  LEFT JOIN subs s     ON s.order_id = p.id
  LEFT JOIN mails m    ON m.order_id = p.id
  ORDER BY p.paid_at DESC;
END;
$$;