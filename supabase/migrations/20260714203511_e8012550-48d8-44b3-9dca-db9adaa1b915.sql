
-- =========================================================
-- LOT 1b — Récurrence, cohortes, localisations
-- =========================================================

CREATE OR REPLACE FUNCTION public.vendor_analytics_recurrence(_from timestamptz, _to timestamptz)
RETURNS TABLE(
  new_customers bigint,
  returning_customers bigint,
  total_customers bigint,
  avg_orders_per_customer numeric,
  avg_days_between_orders numeric,
  churn_risk_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vendor uuid := public.current_vendor_id();
BEGIN
  IF v_vendor IS NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
END $$;

GRANT EXECUTE ON FUNCTION public.vendor_analytics_recurrence(timestamptz, timestamptz) TO authenticated;

-- Cohortes mensuelles : mois d'acquisition + activité les 3 mois suivants
CREATE OR REPLACE FUNCTION public.vendor_analytics_cohorts(_months int DEFAULT 12)
RETURNS TABLE(
  cohort_month date,
  cohort_size bigint,
  active_m1 bigint,
  active_m2 bigint,
  active_m3 bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vendor uuid := public.current_vendor_id();
BEGIN
  IF v_vendor IS NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
END $$;

GRANT EXECUTE ON FUNCTION public.vendor_analytics_cohorts(int) TO authenticated;

-- Localisations agrégées pour la carte
CREATE OR REPLACE FUNCTION public.vendor_analytics_customer_locations(_from timestamptz, _to timestamptz)
RETURNS TABLE(
  country_code text,
  postal_code text,
  city text,
  customers_count bigint,
  orders_count bigint,
  ca_htva_cents bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vendor uuid := public.current_vendor_id();
BEGIN
  IF v_vendor IS NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
END $$;

GRANT EXECUTE ON FUNCTION public.vendor_analytics_customer_locations(timestamptz, timestamptz) TO authenticated;

-- =========================================================
-- LOT 2 — Sell-in vs Sell-out
-- =========================================================

CREATE TABLE IF NOT EXISTS public.vendor_sell_out_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  customer_id uuid,
  customer_label text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  currency_code text NOT NULL DEFAULT 'EUR',
  source text NOT NULL DEFAULT 'manual',
  file_name text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vsor_period_valid CHECK (period_end >= period_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_sell_out_reports TO authenticated;
GRANT ALL ON public.vendor_sell_out_reports TO service_role;
ALTER TABLE public.vendor_sell_out_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors read own sell-out reports"
  ON public.vendor_sell_out_reports FOR SELECT TO authenticated
  USING (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));
CREATE POLICY "vendors insert own sell-out reports"
  ON public.vendor_sell_out_reports FOR INSERT TO authenticated
  WITH CHECK (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));
CREATE POLICY "vendors update own sell-out reports"
  ON public.vendor_sell_out_reports FOR UPDATE TO authenticated
  USING (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()))
  WITH CHECK (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));
CREATE POLICY "vendors delete own sell-out reports"
  ON public.vendor_sell_out_reports FOR DELETE TO authenticated
  USING (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_vsor_vendor ON public.vendor_sell_out_reports(vendor_id, period_start DESC);

CREATE TABLE IF NOT EXISTS public.vendor_sell_out_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.vendor_sell_out_reports(id) ON DELETE CASCADE,
  product_id uuid,
  gtin text,
  cnk_code text,
  raw_label text,
  units integer NOT NULL DEFAULT 0,
  gross_revenue_cents bigint NOT NULL DEFAULT 0,
  net_revenue_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_sell_out_lines TO authenticated;
GRANT ALL ON public.vendor_sell_out_lines TO service_role;
ALTER TABLE public.vendor_sell_out_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors read own sell-out lines"
  ON public.vendor_sell_out_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_sell_out_reports r
    WHERE r.id = report_id AND (r.vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()))));
CREATE POLICY "vendors insert own sell-out lines"
  ON public.vendor_sell_out_lines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_sell_out_reports r
    WHERE r.id = report_id AND (r.vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()))));
CREATE POLICY "vendors update own sell-out lines"
  ON public.vendor_sell_out_lines FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_sell_out_reports r
    WHERE r.id = report_id AND (r.vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()))))
  WITH CHECK (true);
CREATE POLICY "vendors delete own sell-out lines"
  ON public.vendor_sell_out_lines FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_sell_out_reports r
    WHERE r.id = report_id AND (r.vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()))));

CREATE INDEX IF NOT EXISTS idx_vsol_report ON public.vendor_sell_out_lines(report_id);
CREATE INDEX IF NOT EXISTS idx_vsol_product ON public.vendor_sell_out_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_vsol_gtin ON public.vendor_sell_out_lines(gtin);

DROP TRIGGER IF EXISTS trg_vsor_updated_at ON public.vendor_sell_out_reports;
CREATE TRIGGER trg_vsor_updated_at
  BEFORE UPDATE ON public.vendor_sell_out_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sell-in vs Sell-out: agrégation par produit
CREATE OR REPLACE FUNCTION public.vendor_sell_in_vs_sell_out(_report_id uuid)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  gtin text,
  cnk_code text,
  sell_in_units bigint,
  sell_in_ca_htva_cents bigint,
  sell_out_units bigint,
  sell_out_net_cents bigint,
  delta_units bigint,
  sell_through_pct numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vendor uuid;
  v_customer uuid;
  v_from timestamptz;
  v_to timestamptz;
BEGIN
  SELECT r.vendor_id, r.customer_id, r.period_start::timestamptz, (r.period_end + 1)::timestamptz
    INTO v_vendor, v_customer, v_from, v_to
  FROM public.vendor_sell_out_reports r
  WHERE r.id = _report_id;

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'report not found';
  END IF;

  IF v_vendor <> public.current_vendor_id() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH sell_in AS (
    SELECT
      ol.product_id,
      SUM(ol.quantity)::bigint AS units,
      COALESCE(SUM(ol.line_total_excl_vat) * 100, 0)::bigint AS ca_cents
    FROM public.order_lines ol
    JOIN public.orders o ON o.id = ol.order_id
    WHERE ol.vendor_id = v_vendor
      AND (v_customer IS NULL OR o.customer_id = v_customer)
      AND o.created_at >= v_from AND o.created_at < v_to
      AND COALESCE(o.is_forecast, false) = false
      AND o.deleted_at IS NULL
      AND o.status::text NOT IN ('cancelled','refunded','draft')
      AND ol.product_id IS NOT NULL
    GROUP BY ol.product_id
  ),
  sell_out AS (
    SELECT
      COALESCE(l.product_id, p.id) AS product_id,
      MAX(l.gtin) AS gtin,
      MAX(l.cnk_code) AS cnk_code,
      SUM(l.units)::bigint AS units,
      SUM(l.net_revenue_cents)::bigint AS net_cents
    FROM public.vendor_sell_out_lines l
    LEFT JOIN public.products p ON (l.gtin IS NOT NULL AND p.gtin = l.gtin)
    WHERE l.report_id = _report_id
    GROUP BY COALESCE(l.product_id, p.id)
  ),
  merged AS (
    SELECT COALESCE(si.product_id, so.product_id) AS pid,
           si.units AS si_units, si.ca_cents,
           so.units AS so_units, so.net_cents, so.gtin, so.cnk_code
    FROM sell_in si
    FULL OUTER JOIN sell_out so ON so.product_id = si.product_id
  )
  SELECT
    m.pid,
    p.name,
    m.gtin,
    m.cnk_code,
    COALESCE(m.si_units, 0)::bigint,
    COALESCE(m.ca_cents, 0)::bigint,
    COALESCE(m.so_units, 0)::bigint,
    COALESCE(m.net_cents, 0)::bigint,
    (COALESCE(m.si_units, 0) - COALESCE(m.so_units, 0))::bigint,
    CASE WHEN COALESCE(m.si_units, 0) > 0
      THEN ROUND((COALESCE(m.so_units, 0)::numeric / m.si_units::numeric) * 100, 1)
      ELSE NULL END
  FROM merged m
  LEFT JOIN public.products p ON p.id = m.pid
  ORDER BY COALESCE(m.ca_cents, 0) DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.vendor_sell_in_vs_sell_out(uuid) TO authenticated;
