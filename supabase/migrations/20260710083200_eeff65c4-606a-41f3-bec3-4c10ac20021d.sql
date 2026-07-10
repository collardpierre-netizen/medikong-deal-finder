
CREATE OR REPLACE FUNCTION public.get_vendor_buyer_profile(_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_result jsonb;
BEGIN
  v_id := public.current_vendor_id();
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'not_a_vendor';
  END IF;

  -- Ensure vendor has at least one order line with this customer
  IF NOT EXISTS (
    SELECT 1
    FROM public.order_lines ol
    JOIN public.orders o ON o.id = ol.order_id
    WHERE ol.vendor_id = v_id AND o.customer_id = _customer_id
  ) THEN
    RAISE EXCEPTION 'not_authorized_for_customer';
  END IF;

  SELECT jsonb_build_object(
    'customer', (
      SELECT jsonb_build_object(
        'id', c.id,
        'email', c.email,
        'phone', c.phone,
        'company_name', c.company_name,
        'customer_type', c.customer_type,
        'vat_number', c.vat_number,
        'country', c.country,
        'city', c.city
      )
      FROM public.customers c
      WHERE c.id = _customer_id
    ),
    'orders', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'created_at') DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', o.id,
          'order_number', o.order_number,
          'status', o.status,
          'created_at', o.created_at,
          'lines_count', COUNT(ol.id),
          'total_excl_vat_cents', COALESCE(SUM(ROUND(ol.line_total_excl_vat * 100)), 0)
        ) AS x, o.created_at
        FROM public.orders o
        JOIN public.order_lines ol ON ol.order_id = o.id
        WHERE o.customer_id = _customer_id AND ol.vendor_id = v_id
        GROUP BY o.id, o.order_number, o.status, o.created_at
      ) t
    ), '[]'::jsonb),
    'stats', (
      SELECT jsonb_build_object(
        'orders_count', COUNT(DISTINCT o.id),
        'lines_count', COUNT(ol.id),
        'total_excl_vat_cents', COALESCE(SUM(ROUND(ol.line_total_excl_vat * 100)), 0),
        'first_order_at', MIN(o.created_at),
        'last_order_at', MAX(o.created_at)
      )
      FROM public.orders o
      JOIN public.order_lines ol ON ol.order_id = o.id
      WHERE o.customer_id = _customer_id AND ol.vendor_id = v_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_buyer_profile(uuid) TO authenticated;
