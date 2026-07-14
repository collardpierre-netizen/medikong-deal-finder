
-- KPIs période + delta vs période précédente
CREATE OR REPLACE FUNCTION public.vendor_analytics_kpis(_from timestamptz, _to timestamptz)
RETURNS TABLE(
  ca_htva_cents bigint,
  margin_cents bigint,
  commission_cents bigint,
  orders_count bigint,
  active_customers bigint,
  avg_basket_cents bigint,
  prev_ca_htva_cents bigint,
  prev_margin_cents bigint,
  prev_commission_cents bigint,
  prev_orders_count bigint,
  prev_active_customers bigint,
  prev_avg_basket_cents bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor uuid := public.current_vendor_id();
  v_prev_from timestamptz;
  v_prev_to timestamptz;
BEGIN
  IF v_vendor IS NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
    CASE WHEN cur.nb_orders > 0 THEN (cur.ca / cur.nb_orders) ELSE 0 END,
    prev.ca, prev.marge, prev.commish, prev.nb_orders, prev.nb_customers,
    CASE WHEN prev.nb_orders > 0 THEN (prev.ca / prev.nb_orders) ELSE 0 END
  FROM cur, prev;
END;
$$;

-- Répartition CA par profil client
CREATE OR REPLACE FUNCTION public.vendor_analytics_by_customer_type(_from timestamptz, _to timestamptz)
RETURNS TABLE(customer_type text, ca_htva_cents bigint, orders_count bigint, share numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_vendor uuid := public.current_vendor_id();
BEGIN
  IF v_vendor IS NULL AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

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
$$;

-- Répartition par pays
CREATE OR REPLACE FUNCTION public.vendor_analytics_by_country(_from timestamptz, _to timestamptz)
RETURNS TABLE(country_code text, ca_htva_cents bigint, orders_count bigint, share numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_vendor uuid := public.current_vendor_id();
BEGIN
  IF v_vendor IS NULL AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

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
$$;

-- Top clients (avec géoloc)
CREATE OR REPLACE FUNCTION public.vendor_analytics_top_customers(_from timestamptz, _to timestamptz, _limit int DEFAULT 20)
RETURNS TABLE(
  customer_id uuid,
  company_name text,
  customer_type text,
  city text,
  postal_code text,
  country_code text,
  ca_htva_cents bigint,
  orders_count bigint,
  last_order_at timestamptz,
  share numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_vendor uuid := public.current_vendor_id();
BEGIN
  IF v_vendor IS NULL AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

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
$$;

-- Top produits
CREATE OR REPLACE FUNCTION public.vendor_analytics_top_products(_from timestamptz, _to timestamptz, _limit int DEFAULT 20)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  units bigint,
  ca_htva_cents bigint,
  margin_cents bigint,
  commission_cents bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_vendor uuid := public.current_vendor_id();
BEGIN
  IF v_vendor IS NULL AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT ol.product_id,
         p.name,
         SUM(ol.quantity)::bigint,
         (SUM(ol.line_total_excl_vat)*100)::bigint,
         (SUM(COALESCE(ol.line_margin,0))*100)::bigint,
         (SUM(COALESCE(ol.commission_amount,0))*100)::bigint
  FROM public.order_lines ol
  JOIN public.orders o ON o.id = ol.order_id
  LEFT JOIN public.products p ON p.id = ol.product_id
  WHERE ol.vendor_id = v_vendor
    AND o.created_at >= _from AND o.created_at < _to
    AND COALESCE(o.is_forecast, false) = false
    AND o.deleted_at IS NULL
    AND o.status::text NOT IN ('cancelled','refunded','draft')
  GROUP BY ol.product_id, p.name
  ORDER BY SUM(ol.line_total_excl_vat) DESC NULLS LAST
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_analytics_kpis(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_analytics_by_customer_type(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_analytics_by_country(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_analytics_top_customers(timestamptz, timestamptz, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_analytics_top_products(timestamptz, timestamptz, int) TO authenticated;
