DROP FUNCTION IF EXISTS public.get_vendor_order_buyer_contact(uuid);

CREATE OR REPLACE FUNCTION public.get_vendor_order_buyer_contact(_order_id uuid)
RETURNS TABLE(email text, phone text, company_name text, customer_type text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  v_id := public.current_vendor_id();
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'not_a_vendor';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.order_lines ol
    WHERE ol.order_id = _order_id AND ol.vendor_id = v_id
  ) THEN
    RAISE EXCEPTION 'not_authorized_for_order';
  END IF;

  RETURN QUERY
  SELECT
    c.email::text,
    c.phone::text,
    c.company_name::text,
    c.customer_type::text
  FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
  WHERE o.id = _order_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_vendor_order_buyer_contact(uuid) TO authenticated;