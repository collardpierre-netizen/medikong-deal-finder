
CREATE OR REPLACE FUNCTION public.admin_get_order_customer_notes(_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_notes text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT notes INTO v_notes FROM public.orders WHERE id = _order_id;
  RETURN v_notes;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_order_customer_notes(_order_id uuid, _notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.orders
     SET notes = NULLIF(_notes, ''),
         updated_at = now()
   WHERE id = _order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_order_customer_notes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_order_customer_notes(uuid, text) TO authenticated;
