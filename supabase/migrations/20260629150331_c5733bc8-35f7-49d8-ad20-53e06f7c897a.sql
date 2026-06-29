CREATE OR REPLACE FUNCTION public.admin_check_orders_coherence(_order_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(order_id uuid, order_number text, status text, is_forecast boolean, ca_ht numeric, cost_ht numeric, has_cost boolean, marge_ht numeric, commission numeric, commission_pct numeric, coherence text, issue text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH order_agg AS (
    SELECT
      o.id,
      o.order_number,
      o.status::text AS status,
      COALESCE(o.is_forecast, false) AS is_forecast,
      COALESCE(SUM(ol.quantity * ol.unit_price_excl_vat), 0)::numeric AS ca_ht,
      COALESCE(SUM(ol.quantity * COALESCE(ol.cost_price, 0)), 0)::numeric AS cost_ht,
      COALESCE(BOOL_OR(ol.cost_price IS NOT NULL AND ol.cost_price > 0), false) AS has_cost
    FROM public.orders o
    LEFT JOIN public.order_lines ol ON ol.order_id = o.id
    WHERE _order_ids IS NULL OR o.id = ANY(_order_ids)
    GROUP BY o.id
  ),
  sub_agg AS (
    SELECT
      so.order_id,
      COALESCE(SUM(COALESCE(so.commission_amount_override, 0)), 0)::numeric AS commission_total
    FROM public.sub_orders so
    GROUP BY so.order_id
  )
  SELECT
    oa.id,
    oa.order_number,
    oa.status,
    oa.is_forecast,
    ROUND(oa.ca_ht, 2),
    ROUND(oa.cost_ht, 2),
    oa.has_cost,
    CASE WHEN oa.has_cost THEN ROUND(oa.ca_ht - oa.cost_ht, 2) END,
    ROUND(COALESCE(sa.commission_total, 0), 2),
    CASE WHEN oa.ca_ht > 0 THEN ROUND(COALESCE(sa.commission_total, 0) / oa.ca_ht * 100, 2) END,
    CASE
      WHEN COALESCE(sa.commission_total, 0) < 0 THEN 'NEGATIVE'
      WHEN COALESCE(sa.commission_total, 0) > oa.ca_ht + 0.01 THEN 'COMMISSION_GT_CA'
      WHEN oa.has_cost AND COALESCE(sa.commission_total, 0) > (oa.ca_ht - oa.cost_ht) + 0.01 THEN 'COMMISSION_GT_MARGE'
      ELSE 'OK'
    END,
    CASE
      WHEN COALESCE(sa.commission_total, 0) < 0 THEN 'Commission négative'
      WHEN COALESCE(sa.commission_total, 0) > oa.ca_ht + 0.01 THEN 'Commission supérieure au CA HT'
      WHEN oa.has_cost AND COALESCE(sa.commission_total, 0) > (oa.ca_ht - oa.cost_ht) + 0.01 THEN 'Commission supérieure à la marge HT'
      ELSE NULL
    END
  FROM order_agg oa
  LEFT JOIN sub_agg sa ON sa.order_id = oa.id;
END;
$function$;