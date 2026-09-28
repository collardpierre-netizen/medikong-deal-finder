CREATE OR REPLACE FUNCTION public.admin_list_quick_orders(p_language text DEFAULT NULL, p_vat_rate numeric DEFAULT NULL)
RETURNS TABLE (
  id uuid, reference text, created_at timestamptz, status text, language text,
  pharmacy_name text, contact_email text, city text, campaign_id uuid,
  subtotal_ht_cents integer, shipping_ht_cents integer, vat_cents integer, total_ttc_cents integer,
  franco_reached boolean, requested_delivery_date date, vat_rates numeric[], line_count integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT o.id, o.reference, o.created_at, o.status, COALESCE(o.language,'fr'),
         r.pharmacy_name, r.contact_email, r.city, o.campaign_id,
         o.subtotal_ht_cents, o.shipping_ht_cents, o.vat_cents, o.total_ttc_cents,
         o.franco_reached, o.requested_delivery_date,
         COALESCE((SELECT array_agg(DISTINCT l.vat_rate ORDER BY l.vat_rate) FROM qo_order_lines l WHERE l.order_id = o.id), '{}'),
         (SELECT count(*)::int FROM qo_order_lines l WHERE l.order_id = o.id)
  FROM qo_orders o
  LEFT JOIN qo_recipients r ON r.id = o.recipient_id
  WHERE (p_language IS NULL OR COALESCE(o.language,'fr') = p_language)
    AND (p_vat_rate IS NULL OR EXISTS (SELECT 1 FROM qo_order_lines l WHERE l.order_id = o.id AND l.vat_rate = p_vat_rate))
  ORDER BY o.created_at DESC
  LIMIT 5000;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_quick_orders(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_quick_orders(text, numeric) TO authenticated;