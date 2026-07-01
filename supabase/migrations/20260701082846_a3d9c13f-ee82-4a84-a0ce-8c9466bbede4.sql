
-- RPCs analytics clients : progression commandes + KPI par client (unique, moyenne, churn, nouveaux)

CREATE OR REPLACE FUNCTION public.admin_customer_analytics_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH orders_all AS (
    SELECT
      o.id,
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
      customer_id,
      COUNT(*) AS order_count,
      SUM(gmv_ttc) AS gmv_ttc,
      MIN(created_at) AS first_order,
      MAX(created_at) AS last_order
    FROM orders_all
    GROUP BY customer_id
  ),
  totals AS (
    SELECT
      (SELECT COUNT(*) FROM public.customers) AS total_customers,
      COUNT(*) AS customers_with_orders,
      COALESCE(SUM(order_count), 0)::bigint AS total_orders,
      COALESCE(SUM(gmv_ttc), 0)::numeric AS total_gmv,
      COUNT(*) FILTER (WHERE order_count = 1) AS one_shot,
      COUNT(*) FILTER (WHERE order_count >= 2) AS repeat_customers,
      COUNT(*) FILTER (WHERE last_order >= now() - interval '12 months') AS active_12m,
      COUNT(*) FILTER (WHERE last_order < now() - interval '12 months') AS churned_12m,
      COUNT(*) FILTER (WHERE first_order >= now() - interval '30 days') AS new_30d,
      COUNT(*) FILTER (WHERE first_order >= now() - interval '90 days') AS new_90d
    FROM per_customer
  )
  SELECT jsonb_build_object(
    'total_customers', total_customers,
    'customers_with_orders', customers_with_orders,
    'customers_never_ordered', GREATEST(total_customers - customers_with_orders, 0),
    'total_orders', total_orders,
    'total_gmv_ttc', total_gmv,
    'avg_orders_per_customer', CASE WHEN customers_with_orders > 0 THEN ROUND(total_orders::numeric / customers_with_orders, 2) ELSE 0 END,
    'avg_gmv_per_customer', CASE WHEN customers_with_orders > 0 THEN ROUND(total_gmv / customers_with_orders, 2) ELSE 0 END,
    'one_shot_customers', one_shot,
    'repeat_customers', repeat_customers,
    'repeat_rate_pct', CASE WHEN customers_with_orders > 0 THEN ROUND(repeat_customers::numeric * 100 / customers_with_orders, 1) ELSE 0 END,
    'active_12m', active_12m,
    'churned_12m', churned_12m,
    'churn_rate_pct', CASE WHEN customers_with_orders > 0 THEN ROUND(churned_12m::numeric * 100 / customers_with_orders, 1) ELSE 0 END,
    'new_30d', new_30d,
    'new_90d', new_90d
  ) INTO result FROM totals;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_customer_analytics_kpis() TO authenticated;

-- Progression mensuelle (12 mois glissants par défaut)
CREATE OR REPLACE FUNCTION public.admin_customer_analytics_monthly(_months int DEFAULT 12)
RETURNS TABLE (
  month date,
  orders_count bigint,
  unique_customers bigint,
  new_customers bigint,
  returning_customers bigint,
  gmv_ttc numeric
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
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now())::date - ((_months - 1) || ' months')::interval,
      date_trunc('month', now())::date,
      interval '1 month'
    )::date AS month
  ),
  orders_all AS (
    SELECT
      o.id,
      o.customer_id,
      date_trunc('month', o.created_at)::date AS month,
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
    SELECT customer_id, MIN(month) AS first_month FROM orders_all GROUP BY customer_id
  )
  SELECT
    m.month,
    COALESCE(COUNT(o.id), 0)::bigint AS orders_count,
    COALESCE(COUNT(DISTINCT o.customer_id), 0)::bigint AS unique_customers,
    COALESCE(COUNT(DISTINCT o.customer_id) FILTER (WHERE cfo.first_month = m.month), 0)::bigint AS new_customers,
    COALESCE(COUNT(DISTINCT o.customer_id) FILTER (WHERE cfo.first_month < m.month), 0)::bigint AS returning_customers,
    COALESCE(SUM(o.gmv_ttc), 0)::numeric AS gmv_ttc
  FROM months m
  LEFT JOIN orders_all o ON o.month = m.month
  LEFT JOIN customer_first_order cfo ON cfo.customer_id = o.customer_id
  GROUP BY m.month
  ORDER BY m.month;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_customer_analytics_monthly(int) TO authenticated;

-- Classement clients (nb commandes, GMV, statut nouveau/actif/churn)
CREATE OR REPLACE FUNCTION public.admin_customer_analytics_ranking(
  _limit int DEFAULT 200,
  _offset int DEFAULT 0,
  _search text DEFAULT NULL,
  _status text DEFAULT NULL -- 'new'|'active'|'churn'|'never'|NULL
)
RETURNS TABLE (
  customer_id uuid,
  company_name text,
  email text,
  customer_type text,
  country_code text,
  created_at timestamptz,
  order_count bigint,
  gmv_ttc numeric,
  first_order timestamptz,
  last_order timestamptz,
  days_since_last_order int,
  status text,
  total_count bigint
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
    SELECT * FROM scored
    WHERE (_search IS NULL OR company_name ILIKE '%'||_search||'%' OR email ILIKE '%'||_search||'%')
      AND (_status IS NULL OR status = _status)
  ),
  counted AS (
    SELECT COUNT(*)::bigint AS total FROM filtered
  )
  SELECT
    f.customer_id, f.company_name, f.email, f.customer_type, f.country_code,
    f.created_at, f.order_count, f.gmv_ttc, f.first_order, f.last_order,
    f.days_since_last_order, f.status,
    (SELECT total FROM counted) AS total_count
  FROM filtered f
  ORDER BY f.gmv_ttc DESC NULLS LAST, f.order_count DESC
  LIMIT _limit OFFSET _offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_customer_analytics_ranking(int, int, text, text) TO authenticated;
