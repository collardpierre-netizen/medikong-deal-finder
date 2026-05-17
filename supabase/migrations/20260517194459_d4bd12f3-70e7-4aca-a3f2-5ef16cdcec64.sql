CREATE OR REPLACE FUNCTION public.fanout_order_to_vendors(_order_id uuid)
 RETURNS TABLE(vendor_id uuid, vendor_email text, vendor_name text, sub_order_id uuid, vendor_subtotal_incl_vat numeric, line_count integer, order_number text, order_total_incl_vat numeric, magic_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_rec record;
  v_sub_id uuid;
  v_token text;
  v_existing_token text;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', _order_id;
  END IF;

  FOR v_rec IN
    SELECT
      ol.vendor_id AS vendor_id,
      COALESCE(MAX(ol.fulfillment_type::text), 'vendor_direct')::fulfillment_type AS fulfillment_type,
      SUM(ol.line_total_incl_vat) AS subtotal_incl_vat,
      SUM(ol.line_cost) AS cost_total,
      SUM(ol.line_margin) AS margin_total,
      COUNT(*)::int AS line_count,
      COALESCE(v.contact_email, v.shipping_email, v.email) AS vendor_email,
      COALESCE(v.company_name, v.name, 'Vendeur') AS vendor_name
    FROM public.order_lines ol
    JOIN public.vendors v ON v.id = ol.vendor_id
    WHERE ol.order_id = _order_id
    GROUP BY ol.vendor_id, v.contact_email, v.shipping_email, v.email, v.company_name, v.name
  LOOP
    SELECT so.id INTO v_sub_id
    FROM public.sub_orders so
    WHERE so.order_id = _order_id AND so.vendor_id = v_rec.vendor_id
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

      INSERT INTO public.order_line_sub_orders (order_line_id, sub_order_id)
      SELECT ol.id, v_sub_id
      FROM public.order_lines ol
      WHERE ol.order_id = _order_id AND ol.vendor_id = v_rec.vendor_id
      ON CONFLICT DO NOTHING;

      INSERT INTO public.vendor_notifications (
        vendor_id, type, title, body, cta_url, metadata
      ) VALUES (
        v_rec.vendor_id,
        'order_new',
        'Nouvelle commande à traiter',
        format('%s ligne(s) à préparer pour la commande %s', v_rec.line_count, v_order.order_number),
        '/vendor/commandes',
        jsonb_build_object(
          'order_id', _order_id,
          'sub_order_id', v_sub_id,
          'order_number', v_order.order_number
        )
      );

      INSERT INTO public.vendor_notification_dispatch_log (
        vendor_id, source_type, source_id
      ) VALUES (
        v_rec.vendor_id, 'order_new', v_sub_id
      ) ON CONFLICT DO NOTHING;
    END IF;

    -- Magic-link token (idempotent : 1 par sub_order)
    SELECT t.token INTO v_existing_token
    FROM public.vendor_order_tokens t
    WHERE t.sub_order_id = v_sub_id
    LIMIT 1;

    IF v_existing_token IS NULL THEN
      v_token := encode(gen_random_bytes(32), 'base64');
      v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

      INSERT INTO public.vendor_order_tokens (
        sub_order_id, order_id, vendor_id, order_number, token
      ) VALUES (
        v_sub_id, _order_id, v_rec.vendor_id, v_order.order_number, v_token
      );
    ELSE
      v_token := v_existing_token;
    END IF;

    fanout_order_to_vendors.vendor_id := v_rec.vendor_id;
    fanout_order_to_vendors.vendor_email := v_rec.vendor_email;
    fanout_order_to_vendors.vendor_name := v_rec.vendor_name;
    fanout_order_to_vendors.sub_order_id := v_sub_id;
    fanout_order_to_vendors.vendor_subtotal_incl_vat := COALESCE(v_rec.subtotal_incl_vat, 0);
    fanout_order_to_vendors.line_count := v_rec.line_count;
    fanout_order_to_vendors.order_number := v_order.order_number;
    fanout_order_to_vendors.order_total_incl_vat := v_order.total_incl_vat;
    fanout_order_to_vendors.magic_token := v_token;
    RETURN NEXT;
  END LOOP;
END;
$function$;