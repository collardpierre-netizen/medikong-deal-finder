-- Helper: résout le vendeur cible (admin peut cibler n'importe qui)
CREATE OR REPLACE FUNCTION public._resolve_analytics_vendor(_vendor_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current uuid := public.current_vendor_id();
  v_is_admin boolean := public.is_admin(auth.uid());
BEGIN
  IF _vendor_id IS NOT NULL THEN
    IF v_is_admin OR _vendor_id = v_current THEN
      RETURN _vendor_id;
    END IF;
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_current IS NULL AND NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN v_current;
END;
$$;

-- vendor_analytics_kpis
CREATE OR REPLACE FUNCTION public.vendor_analytics_kpis(
  _from timestamp with time zone,
  _to timestamp with time zone,
  _vendor_id uuid DEFAULT NULL
)
RETURNS TABLE(ca_htva_cents bigint, margin_cents bigint, commission_cents bigint, orders_count bigint, active_customers bigint, avg_basket_cents bigint, prev_ca_htva_cents bigint, prev_margin_cents bigint, prev_commission_cents bigint, prev_orders_count bigint, prev_active_customers bigint, prev_avg_basket_cents bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vendor uuid := public._resolve_analytics_vendor(_vendor_id);
  v_prev_from timestamptz;
  v_prev_to timestamptz;
BEGIN
  v_prev_to := _from;
  v_prev_from := _from - (_to - _from);

  RETURN QUERY
  WITH cur AS (
    SELECT
      COALESCE(SUM(ol.line_total_excl_vat) * 100, 0)::bigint AS ca,
      COALESCE(SUM(ol.line_margin) * 100, 0)::bigint AS marge,
      COALESCE(SUM(ol.commission_amount) * 100, 0)::bigint AS commish,
      COUNT(DISTINCT o.id)::bigint AS nb_orders,
      COUNT(DISTINCT o.customer_id)::bigint AS nb_customers
    FROM public.order_lines ol
    JOIN public.orders o ON o.id = ol.order_id
    WHERE ol.vendor_id = v_vendor
      AND o.created_at >= _from AND o.created_at < _to
      AND COALESCE(o.is_forecast, false) = false
      AND o.deleted_at IS NULL
      AND o.status::text NOT IN ('cancelled','refunded','draft')
  ),
  prev AS (
    SELECT
      COALESCE(SUM(ol.line_total_excl_vat) * 100, 0)::bigint AS ca,
      COALESCE(SUM(ol.line_margin) * 100, 0)::bigint AS marge,
      COALESCE(SUM(ol.commission_amount) * 100, 0)::bigint AS commish,
      COUNT(DISTINCT o.id)::bigint AS nb_orders,
      COUNT(DISTINCT o.customer_id)::bigint AS nb_customers
    FROM public.order_lines ol
    JOIN public.orders o ON o.id = ol.order_id
    WHERE ol.vendor_id = v_vendor
      AND o.created_at >= v_prev_from AND o.created_at < v_prev_to
      AND COALESCE(o.is_forecast, false) = false
      AND o.deleted_at IS NULL
      AND o.status::text NOT IN ('cancelled','refunded','draft')
  )
  SELECT
    cur.ca, cur.marge, cur.commish, cur.nb_orders, cur.nb_customers,
    CASE WHEN cur.nb_orders > 0 THEN (cur.ca / cur.nb_orders)::bigint ELSE 0::bigint END,
    prev.ca, prev.marge, prev.commish, prev.nb_orders, prev.nb_customers,
    CASE WHEN prev.nb_orders > 0 THEN (prev.ca / prev.nb_orders)::bigint ELSE 0::bigint END
  FROM cur, prev;
END;
$function$;

-- vendor_analytics_by_customer_type
CREATE OR REPLACE FUNCTION public.vendor_analytics_by_customer_type(
  _from timestamp with time zone,
  _to timestamp with time zone,
  _vendor_id uuid DEFAULT NULL
)
RETURNS TABLE(customer_type text, ca_htva_cents bigint, orders_count bigint, share numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_vendor uuid := public._resolve_analytics_vendor(_vendor_id);
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT COALESCE(c.customer_type::text, 'unknown') AS ctype,
           SUM(ol.line_total_excl_vat) AS ca,
           COUNT(DISTINCT o.id) AS nb
    FROM public.order_lines ol
    JOIN public.orders o ON o.id = ol.order_id
    LEFT JOIN public.customers c ON c.id = o.customer_id
    WHERE ol.vendor_id = v_vendor
      AND o.created_at >= _from AND o.created_at < _to
      AND COALESCE(o.is_forecast, false) = false
      AND o.deleted_at IS NULL
      AND o.status::text NOT IN ('cancelled','refunded','draft')
    GROUP BY 1
  ),
  total AS (SELECT NULLIF(SUM(ca),0) AS total_ca FROM base)
  SELECT b.ctype, (b.ca*100)::bigint, b.nb::bigint,
         ROUND((b.ca / t.total_ca * 100)::numeric, 2)
  FROM base b, total t
  ORDER BY b.ca DESC NULLS LAST;
END;
$function$;

-- vendor_analytics_by_country
CREATE OR REPLACE FUNCTION public.vendor_analytics_by_country(
  _from timestamp with time zone,
  _to timestamp with time zone,
  _vendor_id uuid DEFAULT NULL
)
RETURNS TABLE(country_code text, ca_htva_cents bigint, orders_count bigint, share numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_vendor uuid := public._resolve_analytics_vendor(_vendor_id);
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT COALESCE(c.country_code, 'UNK') AS cc,
           SUM(ol.line_total_excl_vat) AS ca,
           COUNT(DISTINCT o.id) AS nb
    FROM public.order_lines ol
    JOIN public.orders o ON o.id = ol.order_id
    LEFT JOIN public.customers c ON c.id = o.customer_id
    WHERE ol.vendor_id = v_vendor
      AND o.created_at >= _from AND o.created_at < _to
      AND COALESCE(o.is_forecast, false) = false
      AND o.deleted_at IS NULL
      AND o.status::text NOT IN ('cancelled','refunded','draft')
    GROUP BY 1
  ),
  total AS (SELECT NULLIF(SUM(ca),0) AS total_ca FROM base)
  SELECT b.cc, (b.ca*100)::bigint, b.nb::bigint,
         ROUND((b.ca / t.total_ca * 100)::numeric, 2)
  FROM base b, total t
  ORDER BY b.ca DESC NULLS LAST;
END;
$function$;

-- vendor_analytics_top_customers
CREATE OR REPLACE FUNCTION public.vendor_analytics_top_customers(
  _from timestamp with time zone,
  _to timestamp with time zone,
  _limit integer DEFAULT 20,
  _vendor_id uuid DEFAULT NULL
)
RETURNS TABLE(customer_id uuid, company_name text, customer_type text, city text, postal_code text, country_code text, ca_htva_cents bigint, orders_count bigint, last_order_at timestamp with time zone, share numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_vendor uuid := public._resolve_analytics_vendor(_vendor_id);
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT o.customer_id,
           c.company_name, c.customer_type::text AS ctype,
           c.city, c.postal_code, c.country_code,
           SUM(ol.line_total_excl_vat) AS ca,
           COUNT(DISTINCT o.id) AS nb,
           MAX(o.created_at) AS last_at
    FROM public.order_lines ol
    JOIN public.orders o ON o.id = ol.order_id
    LEFT JOIN public.customers c ON c.id = o.customer_id
    WHERE ol.vendor_id = v_vendor
      AND o.created_at >= _from AND o.created_at < _to
      AND COALESCE(o.is_forecast, false) = false
      AND o.deleted_at IS NULL
      AND o.status::text NOT IN ('cancelled','refunded','draft')
      AND o.customer_id IS NOT NULL
    GROUP BY o.customer_id, c.company_name, c.customer_type, c.city, c.postal_code, c.country_code
  ),
  total AS (SELECT NULLIF(SUM(ca),0) AS total_ca FROM base)
  SELECT b.customer_id, b.company_name, b.ctype, b.city, b.postal_code, b.country_code,
         (b.ca*100)::bigint, b.nb::bigint, b.last_at,
         ROUND((b.ca / t.total_ca * 100)::numeric, 2)
  FROM base b, total t
  ORDER BY b.ca DESC NULLS LAST
  LIMIT _limit;
END;
$function$;

-- vendor_analytics_top_products
CREATE OR REPLACE FUNCTION public.vendor_analytics_top_products(
  _from timestamp with time zone,
  _to timestamp with time zone,
  _limit integer DEFAULT 20,
  _vendor_id uuid DEFAULT NULL
)
RETURNS TABLE(product_id uuid, product_name text, units bigint, ca_htva_cents bigint, margin_cents bigint, commission_cents bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_vendor uuid := public._resolve_analytics_vendor(_vendor_id);
BEGIN
  RETURN QUERY
  SELECT
    ol.product_id,
    MAX(COALESCE(p.name, ol.product_name_snapshot))::text,
    COALESCE(SUM(ol.quantity), 0)::bigint,
    COALESCE(SUM(ol.line_total_excl_vat) * 100, 0)::bigint,
    COALESCE(SUM(ol.line_margin) * 100, 0)::bigint,
    COALESCE(SUM(ol.commission_amount) * 100, 0)::bigint
  FROM public.order_lines ol
  JOIN public.orders o ON o.id = ol.order_id
  LEFT JOIN public.products p ON p.id = ol.product_id
  WHERE ol.vendor_id = v_vendor
    AND o.created_at >= _from AND o.created_at < _to
    AND COALESCE(o.is_forecast, false) = false
    AND o.deleted_at IS NULL
    AND o.status::text NOT IN ('cancelled','refunded','draft')
  GROUP BY ol.product_id
  ORDER BY 4 DESC NULLS LAST
  LIMIT _limit;
END;
$function$;

-- vendor_analytics_recurrence
CREATE OR REPLACE FUNCTION public.vendor_analytics_recurrence(
  _from timestamp with time zone,
  _to timestamp with time zone,
  _vendor_id uuid DEFAULT NULL
)
RETURNS TABLE(new_customers bigint, returning_customers bigint, total_customers bigint, avg_orders_per_customer numeric, avg_days_between_orders numeric, churn_risk_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_vendor uuid := public._resolve_analytics_vendor(_vendor_id);
BEGIN
  RETURN QUERY
  WITH first_orders AS (
    SELECT o.customer_id, MIN(o.created_at) AS first_at
    FROM public.orders o
    JOIN public.order_lines ol ON ol.order_id = o.id
    WHERE ol.vendor_id = v_vendor
      AND COALESCE(o.is_forecast, false) = false
      AND o.deleted_at IS NULL
      AND o.status::text NOT IN ('cancelled','refunded','draft')
    GROUP BY o.customer_id
  ),
  period_orders AS (
    SELECT DISTINCT o.customer_id, o.id, o.created_at
    FROM public.orders o
    JOIN public.order_lines ol ON ol.order_id = o.id
    WHERE ol.vendor_id = v_vendor
      AND o.created_at >= _from AND o.created_at < _to
      AND COALESCE(o.is_forecast, false) = false
      AND o.deleted_at IS NULL
      AND o.status::text NOT IN ('cancelled','refunded','draft')
  ),
  agg AS (
    SELECT
      COUNT(DISTINCT po.customer_id) FILTER (WHERE fo.first_at >= _from AND fo.first_at < _to) AS new_c,
      COUNT(DISTINCT po.customer_id) FILTER (WHERE fo.first_at < _from) AS ret_c,
      COUNT(DISTINCT po.customer_id) AS tot_c,
      COUNT(po.id)::numeric AS nb_orders
    FROM period_orders po
    LEFT JOIN first_orders fo ON fo.customer_id = po.customer_id
  ),
  gaps AS (
    SELECT customer_id,
           EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY customer_id ORDER BY created_at))) / 86400.0 AS days_diff
    FROM period_orders
  ),
  last_seen AS (
    SELECT customer_id, MAX(created_at) AS last_at
    FROM period_orders
    GROUP BY customer_id
  )
  SELECT
    COALESCE(agg.new_c, 0)::bigint,
    COALESCE(agg.ret_c, 0)::bigint,
    COALESCE(agg.tot_c, 0)::bigint,
    CASE WHEN agg.tot_c > 0 THEN ROUND(agg.nb_orders / agg.tot_c, 2) ELSE 0 END::numeric,
    COALESCE(ROUND(AVG(gaps.days_diff)::numeric, 1), 0)::numeric,
    (SELECT COUNT(*) FROM last_seen WHERE last_at < now() - interval '60 days')::bigint
  FROM agg
  LEFT JOIN gaps ON true
  GROUP BY agg.new_c, agg.ret_c, agg.tot_c, agg.nb_orders;
END;
$function$;

-- vendor_analytics_cohorts
CREATE OR REPLACE FUNCTION public.vendor_analytics_cohorts(
  _months integer DEFAULT 12,
  _vendor_id uuid DEFAULT NULL
)
RETURNS TABLE(cohort_month date, cohort_size bigint, active_m1 bigint, active_m2 bigint, active_m3 bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_vendor uuid := public._resolve_analytics_vendor(_vendor_id);
BEGIN
  RETURN QUERY
  WITH first_orders AS (
    SELECT o.customer_id, date_trunc('month', MIN(o.created_at))::date AS cohort_m
    FROM public.orders o
    JOIN public.order_lines ol ON ol.order_id = o.id
    WHERE ol.vendor_id = v_vendor
      AND COALESCE(o.is_forecast, false) = false
      AND o.deleted_at IS NULL
      AND o.status::text NOT IN ('cancelled','refunded','draft')
    GROUP BY o.customer_id
  ),
  activity AS (
    SELECT DISTINCT o.customer_id, date_trunc('month', o.created_at)::date AS m
    FROM public.orders o
    JOIN public.order_lines ol ON ol.order_id = o.id
    WHERE ol.vendor_id = v_vendor
      AND COALESCE(o.is_forecast, false) = false
      AND o.deleted_at IS NULL
      AND o.status::text NOT IN ('cancelled','refunded','draft')
  )
  SELECT
    fo.cohort_m,
    COUNT(DISTINCT fo.customer_id)::bigint,
    COUNT(DISTINCT a1.customer_id)::bigint,
    COUNT(DISTINCT a2.customer_id)::bigint,
    COUNT(DISTINCT a3.customer_id)::bigint
  FROM first_orders fo
  LEFT JOIN activity a1 ON a1.customer_id = fo.customer_id AND a1.m = fo.cohort_m + interval '1 month'
  LEFT JOIN activity a2 ON a2.customer_id = fo.customer_id AND a2.m = fo.cohort_m + interval '2 month'
  LEFT JOIN activity a3 ON a3.customer_id = fo.customer_id AND a3.m = fo.cohort_m + interval '3 month'
  WHERE fo.cohort_m >= (date_trunc('month', now()) - (_months || ' months')::interval)::date
  GROUP BY fo.cohort_m
  ORDER BY fo.cohort_m;
END;
$function$;

-- vendor_analytics_customer_locations
CREATE OR REPLACE FUNCTION public.vendor_analytics_customer_locations(
  _from timestamp with time zone,
  _to timestamp with time zone,
  _vendor_id uuid DEFAULT NULL
)
RETURNS TABLE(country_code text, postal_code text, city text, customers_count bigint, orders_count bigint, ca_htva_cents bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_vendor uuid := public._resolve_analytics_vendor(_vendor_id);
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(NULLIF(c.country_code, ''), 'UNK')::text,
    COALESCE(NULLIF(c.postal_code, ''), '-')::text,
    COALESCE(NULLIF(c.city, ''), '-')::text,
    COUNT(DISTINCT o.customer_id)::bigint,
    COUNT(DISTINCT o.id)::bigint,
    COALESCE(SUM(ol.line_total_excl_vat) * 100, 0)::bigint
  FROM public.order_lines ol
  JOIN public.orders o ON o.id = ol.order_id
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE ol.vendor_id = v_vendor
    AND o.created_at >= _from AND o.created_at < _to
    AND COALESCE(o.is_forecast, false) = false
    AND o.deleted_at IS NULL
    AND o.status::text NOT IN ('cancelled','refunded','draft')
  GROUP BY 1, 2, 3
  ORDER BY ca_htva_cents DESC
  LIMIT 500;
END;
$function$;
