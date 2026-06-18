
-- ============================================================
-- Lot 2 : Recalcul automatique du statut commande
-- ============================================================
CREATE OR REPLACE FUNCTION public._recompute_order_status(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total int;
  cnt_cancelled int;
  cnt_delivered int;
  cnt_shipped int;
  cnt_pending_or_processing int;
  new_status order_status;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE fulfillment_status = 'cancelled'),
    count(*) FILTER (WHERE fulfillment_status = 'delivered'),
    count(*) FILTER (WHERE fulfillment_status = 'shipped'),
    count(*) FILTER (WHERE fulfillment_status IN ('pending','processing','forwarded'))
  INTO total, cnt_cancelled, cnt_delivered, cnt_shipped, cnt_pending_or_processing
  FROM public.order_lines
  WHERE order_id = _order_id;

  IF total = 0 THEN
    RETURN;
  END IF;

  IF cnt_cancelled = total THEN
    new_status := 'cancelled';
  ELSIF (cnt_delivered + cnt_cancelled) = total AND cnt_delivered > 0 THEN
    new_status := 'delivered';
  ELSIF (cnt_shipped + cnt_delivered + cnt_cancelled) = total AND (cnt_shipped + cnt_delivered) > 0 THEN
    new_status := 'shipped';
  ELSIF (cnt_shipped + cnt_delivered) > 0 AND cnt_pending_or_processing > 0 THEN
    new_status := 'partially_shipped';
  ELSE
    new_status := 'processing';
  END IF;

  UPDATE public.orders
  SET status = new_status,
      updated_at = now()
  WHERE id = _order_id
    AND status IS DISTINCT FROM new_status;
END;
$$;

CREATE OR REPLACE FUNCTION public._order_lines_recompute_order_status_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public._recompute_order_status(OLD.order_id);
    RETURN OLD;
  ELSE
    PERFORM public._recompute_order_status(NEW.order_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_lines_recompute_order_status ON public.order_lines;
CREATE TRIGGER trg_order_lines_recompute_order_status
AFTER INSERT OR UPDATE OF fulfillment_status OR DELETE
ON public.order_lines
FOR EACH ROW
EXECUTE FUNCTION public._order_lines_recompute_order_status_trg();


-- ============================================================
-- Lot 1 : Notification admin quand le vendeur annule une ligne
-- (remboursement Stripe manuel en V1)
-- ============================================================
CREATE OR REPLACE FUNCTION public._order_line_notify_admin_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_number text;
  v_vendor_name text;
  v_product_name text;
BEGIN
  IF NEW.fulfillment_status = 'cancelled'
     AND (OLD.fulfillment_status IS DISTINCT FROM 'cancelled')
  THEN
    SELECT o.order_number INTO v_order_number FROM public.orders o WHERE o.id = NEW.order_id;
    SELECT v.name INTO v_vendor_name FROM public.vendors v WHERE v.id = NEW.vendor_id;
    SELECT p.name INTO v_product_name FROM public.products p WHERE p.id = NEW.product_id;

    INSERT INTO public.admin_notifications (
      type, severity, title, body, cta_url, payload, source_type, source_id
    ) VALUES (
      'order_line_cancelled_by_vendor',
      'warning',
      'Remboursement à traiter — ' || COALESCE(v_order_number, NEW.order_id::text),
      'Le vendeur ' || COALESCE(v_vendor_name, 'inconnu')
        || ' a annulé la ligne « ' || COALESCE(v_product_name, '—') || ' » (qté '
        || NEW.quantity || ', ' || COALESCE(NEW.line_total_incl_vat::text, '—') || ' € TTC). '
        || COALESCE('Motif : ' || NEW.cancellation_reason, 'Aucun motif fourni.'),
      '/admin/commandes/' || NEW.order_id::text,
      jsonb_build_object(
        'order_id', NEW.order_id,
        'order_line_id', NEW.id,
        'vendor_id', NEW.vendor_id,
        'product_id', NEW.product_id,
        'quantity', NEW.quantity,
        'refund_amount_incl_vat', NEW.refunded_amount_incl_vat,
        'line_total_incl_vat', NEW.line_total_incl_vat,
        'reason', NEW.cancellation_reason
      ),
      'order_line',
      NEW.id
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_line_notify_admin_on_cancel ON public.order_lines;
CREATE TRIGGER trg_order_line_notify_admin_on_cancel
AFTER UPDATE OF fulfillment_status
ON public.order_lines
FOR EACH ROW
EXECUTE FUNCTION public._order_line_notify_admin_on_cancel();


-- ============================================================
-- Lot 3 : RPC SLA — détecte les lignes en retard et logge alertes
-- Appelée par l'edge function planifiée check-order-line-sla
-- ============================================================
CREATE OR REPLACE FUNCTION public.scan_order_line_sla_alerts()
RETURNS TABLE (alerts_created int, lines_overdue int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_hours_to_ship int;
  v_line RECORD;
  v_created int := 0;
  v_overdue int := 0;
  v_order_number text;
  v_vendor_name text;
  v_product_name text;
BEGIN
  SELECT * INTO v_settings FROM public.vendor_sla_settings ORDER BY id LIMIT 1;
  v_hours_to_ship := COALESCE(v_settings.hours_to_ship, 48);

  IF v_settings.enabled IS DISTINCT FROM true THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  FOR v_line IN
    SELECT ol.id, ol.order_id, ol.vendor_id, ol.product_id, ol.fulfillment_status,
           ol.quantity, ol.line_total_incl_vat,
           ol.updated_at,
           EXTRACT(EPOCH FROM (now() - ol.updated_at)) / 3600.0 AS hours_since_update
    FROM public.order_lines ol
    WHERE ol.fulfillment_status IN ('pending','processing')
      AND ol.fulfillment_type <> 'qogita'
      AND (now() - ol.updated_at) > make_interval(hours => v_hours_to_ship)
      AND NOT EXISTS (
        SELECT 1 FROM public.order_vendor_sla_alerts a
        WHERE a.order_id = ol.order_id
          AND a.vendor_id = ol.vendor_id
          AND (a.payload->>'order_line_id')::uuid = ol.id
          AND a.resolved_at IS NULL
      )
  LOOP
    v_overdue := v_overdue + 1;

    SELECT order_number INTO v_order_number FROM public.orders WHERE id = v_line.order_id;
    SELECT name INTO v_vendor_name FROM public.vendors WHERE id = v_line.vendor_id;
    SELECT name INTO v_product_name FROM public.products WHERE id = v_line.product_id;

    INSERT INTO public.order_vendor_sla_alerts (
      order_id, vendor_id, alert_type, severity,
      hours_overdue, threshold_hours, payload, notified_admin_at
    ) VALUES (
      v_line.order_id, v_line.vendor_id,
      CASE WHEN v_line.fulfillment_status = 'pending' THEN 'overdue_ship_pending' ELSE 'overdue_ship_processing' END,
      CASE WHEN v_line.hours_since_update > v_hours_to_ship * 2 THEN 'critical' ELSE 'warning' END,
      v_line.hours_since_update,
      v_hours_to_ship,
      jsonb_build_object(
        'order_line_id', v_line.id,
        'product_id', v_line.product_id,
        'quantity', v_line.quantity,
        'fulfillment_status', v_line.fulfillment_status,
        'last_update', v_line.updated_at
      ),
      now()
    );
    v_created := v_created + 1;

    INSERT INTO public.admin_notifications (
      type, severity, title, body, cta_url, payload, source_type, source_id
    ) VALUES (
      'order_line_sla_overdue',
      CASE WHEN v_line.hours_since_update > v_hours_to_ship * 2 THEN 'critical' ELSE 'warning' END,
      'Ligne en retard — ' || COALESCE(v_order_number, v_line.order_id::text),
      'Vendeur ' || COALESCE(v_vendor_name, '—')
        || ' : ligne « ' || COALESCE(v_product_name, '—')
        || ' » bloquée en statut "' || v_line.fulfillment_status
        || '" depuis ' || round(v_line.hours_since_update::numeric, 1) || 'h '
        || '(seuil ' || v_hours_to_ship || 'h).',
      '/admin/commandes/' || v_line.order_id::text,
      jsonb_build_object(
        'order_id', v_line.order_id,
        'order_line_id', v_line.id,
        'vendor_id', v_line.vendor_id,
        'hours_overdue', v_line.hours_since_update,
        'threshold_hours', v_hours_to_ship
      ),
      'order_line',
      v_line.id
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN QUERY SELECT v_created, v_overdue;
END;
$$;

REVOKE ALL ON FUNCTION public.scan_order_line_sla_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_order_line_sla_alerts() TO service_role;
