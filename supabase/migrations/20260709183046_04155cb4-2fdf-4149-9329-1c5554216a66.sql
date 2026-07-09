CREATE OR REPLACE FUNCTION public.admin_customer_analytics_monthly(_months integer DEFAULT 12)
 RETURNS TABLE(month date, orders_count bigint, unique_customers bigint, new_customers bigint, returning_customers bigint, gmv_ttc numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now())::date - ((_months - 1) || ' months')::interval,
      date_trunc('month', now())::date,
      interval '1 month'
    )::date AS m
  ),
  orders_all AS (
    SELECT
      o.id,
      o.customer_id,
      date_trunc('month', o.created_at)::date AS m,
      GREATEST(
        COALESCE(o.total_incl_vat, 0),
        COALESCE((
          SELECT SUM(COALESCE(ol.line_total_incl_vat, ol.quantity * ol.unit_price_incl_vat, 0))
          FROM public.order_lines ol WHERE ol.order_id = o.id
        ), 0)
      )::numeric AS gmv_ttc
    FROM public.orders o
    WHERE COALESCE(o.hidden_from_list, false) = false
      AND o.deleted_at IS NULL
      AND o.customer_id IS NOT NULL
  ),
  customer_first_order AS (
    SELECT oa.customer_id, MIN(oa.m) AS first_month FROM orders_all oa GROUP BY oa.customer_id
  )
  SELECT
    mm.m AS month,
    COALESCE(COUNT(oa.id), 0)::bigint AS orders_count,
    COALESCE(COUNT(DISTINCT oa.customer_id), 0)::bigint AS unique_customers,
    COALESCE(COUNT(DISTINCT oa.customer_id) FILTER (WHERE cfo.first_month = mm.m), 0)::bigint AS new_customers,
    COALESCE(COUNT(DISTINCT oa.customer_id) FILTER (WHERE cfo.first_month < mm.m), 0)::bigint AS returning_customers,
    COALESCE(SUM(oa.gmv_ttc), 0)::numeric AS gmv_ttc
  FROM months mm
  LEFT JOIN orders_all oa ON oa.m = mm.m
  LEFT JOIN customer_first_order cfo ON cfo.customer_id = oa.customer_id
  GROUP BY mm.m
  ORDER BY mm.m;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_customer_analytics_ranking(_limit integer DEFAULT 200, _offset integer DEFAULT 0, _search text DEFAULT NULL::text, _status text DEFAULT NULL::text)
 RETURNS TABLE(customer_id uuid, company_name text, email text, customer_type text, country_code text, created_at timestamp with time zone, order_count bigint, gmv_ttc numeric, first_order timestamp with time zone, last_order timestamp with time zone, days_since_last_order integer, status text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH orders_all AS (
    SELECT
      o.customer_id,
      o.created_at,
      GREATEST(
        COALESCE(o.total_incl_vat, 0),
        COALESCE((
          SELECT SUM(COALESCE(ol.line_total_incl_vat, ol.quantity * ol.unit_price_incl_vat, 0))
          FROM public.order_lines ol WHERE ol.order_id = o.id
        ), 0)
      )::numeric AS gmv_ttc
    FROM public.orders o
    WHERE COALESCE(o.hidden_from_list, false) = false
      AND o.deleted_at IS NULL
      AND o.customer_id IS NOT NULL
  ),
  per_customer AS (
    SELECT
      c.id AS customer_id,
      c.company_name,
      c.email,
      c.customer_type::text AS customer_type,
      c.country_code,
      c.created_at,
      COUNT(oa.customer_id)::bigint AS order_count,
      COALESCE(SUM(oa.gmv_ttc), 0)::numeric AS gmv_ttc,
      MIN(oa.created_at) AS first_order,
      MAX(oa.created_at) AS last_order
    FROM public.customers c
    LEFT JOIN orders_all oa ON oa.customer_id = c.id
    GROUP BY c.id
  ),
  scored AS (
    SELECT
      pc.*,
      CASE
        WHEN pc.order_count = 0 THEN NULL
        ELSE EXTRACT(DAY FROM (now() - pc.last_order))::int
      END AS days_since_last_order,
      CASE
        WHEN pc.order_count = 0 THEN 'never'
        WHEN pc.first_order >= now() - interval '90 days' THEN 'new'
        WHEN pc.last_order < now() - interval '12 months' THEN 'churn'
        ELSE 'active'
      END AS status
    FROM per_customer pc
  ),
  filtered AS (
    SELECT s.* FROM scored s
    WHERE (_search IS NULL OR s.company_name ILIKE '%'||_search||'%' OR s.email ILIKE '%'||_search||'%')
      AND (_status IS NULL OR s.status = _status)
  ),
  counted AS (
    SELECT COUNT(*)::bigint AS total FROM filtered
  )
  SELECT
    f.customer_id, f.company_name, f.email, f.customer_type, f.country_code,
    f.created_at, f.order_count, f.gmv_ttc, f.first_order, f.last_order,
    f.days_since_last_order, f.status,
    (SELECT c.total FROM counted c) AS total_count
  FROM filtered f
  ORDER BY f.gmv_ttc DESC NULLS LAST, f.order_count DESC
  LIMIT _limit OFFSET _offset;
END;
$function$;