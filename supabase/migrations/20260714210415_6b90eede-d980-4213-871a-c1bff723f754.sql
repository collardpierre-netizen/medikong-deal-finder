CREATE OR REPLACE FUNCTION public.vendor_analytics_customer_locations(
  _from timestamp with time zone,
  _to timestamp with time zone,
  _vendor_id uuid DEFAULT NULL::uuid,
  _product_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  country_code text,
  postal_code text,
  city text,
  customers_count bigint,
  orders_count bigint,
  ca_htva_cents bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
    AND (_product_id IS NULL OR ol.product_id = _product_id)
  GROUP BY 1, 2, 3
  ORDER BY ca_htva_cents DESC
  LIMIT 500;
END;
$function$;