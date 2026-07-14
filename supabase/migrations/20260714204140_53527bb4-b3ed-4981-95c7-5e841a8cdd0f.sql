
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
  -- Résolution du produit ligne par ligne (priorité: product_id explicite > GTIN > CNK via product_market_codes > CNK via products.cnk_code)
  sell_out_lines_resolved AS (
    SELECT
      l.id,
      COALESCE(
        l.product_id,
        (SELECT p.id FROM public.products p WHERE l.gtin IS NOT NULL AND p.gtin = l.gtin LIMIT 1),
        (SELECT pmc.product_id
           FROM public.product_market_codes pmc
           JOIN public.market_code_types mct ON mct.id = pmc.market_code_type_id
          WHERE l.cnk_code IS NOT NULL
            AND UPPER(mct.code) IN ('CNK','BE_CNK','CNK_BE')
            AND pmc.code_value = l.cnk_code
          LIMIT 1),
        (SELECT p.id FROM public.products p WHERE l.cnk_code IS NOT NULL AND p.cnk_code = l.cnk_code LIMIT 1)
      ) AS resolved_product_id,
      l.gtin,
      l.cnk_code,
      l.units,
      l.net_revenue_cents
    FROM public.vendor_sell_out_lines l
    WHERE l.report_id = _report_id
  ),
  sell_out AS (
    SELECT
      resolved_product_id AS product_id,
      MAX(gtin) AS gtin,
      MAX(cnk_code) AS cnk_code,
      SUM(units)::bigint AS units,
      SUM(net_revenue_cents)::bigint AS net_cents
    FROM sell_out_lines_resolved
    GROUP BY resolved_product_id
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
