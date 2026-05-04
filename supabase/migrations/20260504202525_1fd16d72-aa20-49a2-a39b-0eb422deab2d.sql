CREATE OR REPLACE FUNCTION public.fanout_order_to_vendors(_order_id uuid)
RETURNS TABLE (
  vendor_id uuid,
  vendor_email text,
  vendor_name text,
  sub_order_id uuid,
  vendor_subtotal_incl_vat numeric,
  line_count integer,
  order_number text,
  order_total_incl_vat numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_rec record;
  v_sub_id uuid;
  v_notif_id uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', _order_id;
  END IF;

  FOR v_rec IN
    SELECT
      ol.vendor_id,
      COALESCE(MAX(ol.fulfillment_type::text), 'vendor_direct')::fulfillment_type AS fulfillment_type,
      SUM(ol.line_total_incl_vat) AS subtotal_incl_vat,
      SUM(ol.line_cost) AS cost_total,
      SUM(ol.line_margin) AS margin_total,
      COUNT(*)::int AS line_count,
      v.email AS vendor_email,
      COALESCE(v.company_name, v.name, 'Vendeur') AS vendor_name
    FROM public.order_lines ol
    JOIN public.vendors v ON v.id = ol.vendor_id
    WHERE ol.order_id = _order_id
    GROUP BY ol.vendor_id, v.email, v.company_name, v.name
  LOOP
    -- 1) sub_order (one per vendor) — idempotent
    SELECT id INTO v_sub_id
    FROM public.sub_orders
    WHERE order_id = _order_id AND vendor_id = v_rec.vendor_id
    LIMIT 1;

    IF v_sub_id IS NULL THEN
      INSERT INTO public.sub_orders (
        order_id, vendor_id, fulfillment_type, status,
        subtotal_incl_vat, cost_total, margin_total
      ) VALUES (
        _order_id, v_rec.vendor_id, v_rec.fulfillment_type, 'pending',
        COALESCE(v_rec.subtotal_incl_vat, 0),
        v_rec.cost_total,
        v_rec.margin_total
      )
      RETURNING id INTO v_sub_id;

      -- Lien lignes <-> sub_order
      INSERT INTO public.order_line_sub_orders (order_line_id, sub_order_id)
      SELECT ol.id, v_sub_id
      FROM public.order_lines ol
      WHERE ol.order_id = _order_id AND ol.vendor_id = v_rec.vendor_id
      ON CONFLICT DO NOTHING;
    END IF;

    -- 2) Notification vendeur (cloche) — idempotent via dispatch log
    IF NOT EXISTS (
      SELECT 1 FROM public.vendor_notification_dispatch_log
      WHERE vendor_id = v_rec.vendor_id
        AND source_type = 'order_new'
        AND source_id = v_sub_id
    ) THEN
      INSERT INTO public.vendor_notifications (vendor_id, type, title, body, payload, cta_url)
      VALUES (
        v_rec.vendor_id,
        'order_new',
        'Nouvelle commande ' || v_order.order_number,
        v_rec.line_count || ' ligne(s) à traiter — total ' ||
          to_char(COALESCE(v_rec.subtotal_incl_vat, 0), 'FM999G990D00') || ' EUR TTC',
        jsonb_build_object(
          'order_id', _order_id,
          'sub_order_id', v_sub_id,
          'order_number', v_order.order_number,
          'subtotal_incl_vat', v_rec.subtotal_incl_vat,
          'line_count', v_rec.line_count
        ),
        '/vendor/commandes'
      )
      RETURNING id INTO v_notif_id;

      INSERT INTO public.vendor_notification_dispatch_log
        (vendor_id, source_type, source_id, notification_id)
      VALUES (v_rec.vendor_id, 'order_new', v_sub_id, v_notif_id)
      ON CONFLICT (vendor_id, source_type, source_id) DO NOTHING;
    END IF;

    vendor_id := v_rec.vendor_id;
    vendor_email := v_rec.vendor_email;
    vendor_name := v_rec.vendor_name;
    sub_order_id := v_sub_id;
    vendor_subtotal_incl_vat := COALESCE(v_rec.subtotal_incl_vat, 0);
    line_count := v_rec.line_count;
    order_number := v_order.order_number;
    order_total_incl_vat := v_order.total_incl_vat;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.fanout_order_to_vendors(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fanout_order_to_vendors(uuid) TO service_role;

-- Allow new dispatch source 'order_new' (text col, no constraint to update)

-- Index pratique pour la page admin "lignes en retard"
CREATE INDEX IF NOT EXISTS idx_sla_alerts_open_recent
  ON public.order_vendor_sla_alerts(created_at DESC)
  WHERE resolved_at IS NULL;