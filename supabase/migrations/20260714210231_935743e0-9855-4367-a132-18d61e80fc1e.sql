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
    MAX(COALESCE(p.name, ol.manual_label, 'Produit inconnu'))::text,
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