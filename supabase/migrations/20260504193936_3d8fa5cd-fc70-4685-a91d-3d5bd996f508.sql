
-- 1) SOFT-DELETE COMMANDES
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS hidden_from_list boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_reason text;

CREATE INDEX IF NOT EXISTS idx_orders_hidden ON public.orders(hidden_from_list) WHERE hidden_from_list = true;

CREATE OR REPLACE VIEW public.orders_visible_v
WITH (security_invoker = true) AS
SELECT * FROM public.orders WHERE hidden_from_list = false;

CREATE OR REPLACE FUNCTION public.admin_soft_delete_order(_order_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  UPDATE public.orders
  SET status = 'cancelled'::order_status, hidden_from_list = true,
      deleted_at = now(), deleted_by = auth.uid(), deleted_reason = _reason, updated_at = now()
  WHERE id = _order_id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'order.soft_delete', 'order', _order_id, jsonb_build_object('reason', _reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  UPDATE public.orders SET hidden_from_list = false, deleted_at = NULL, deleted_by = NULL,
      deleted_reason = NULL, updated_at = now() WHERE id = _order_id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'order.restore', 'order', _order_id, '{}'::jsonb);
END;
$$;

-- 2) SUB-ORDER SLA TIMESTAMPS
ALTER TABLE public.sub_orders
  ADD COLUMN IF NOT EXISTS vendor_first_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sla_check_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sub_orders_sla_pending
  ON public.sub_orders(status, created_at)
  WHERE status IN ('pending'::fulfillment_status, 'processing'::fulfillment_status, 'forwarded'::fulfillment_status);

-- 3) SETTINGS (singleton)
CREATE TABLE IF NOT EXISTS public.vendor_sla_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  hours_to_view integer NOT NULL DEFAULT 1,
  hours_to_confirm integer NOT NULL DEFAULT 12,
  hours_to_ship integer NOT NULL DEFAULT 24,
  hours_critical_escalation integer NOT NULL DEFAULT 48,
  notify_admin_email text,
  slack_webhook_url text,
  send_vendor_reminder boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.vendor_sla_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.vendor_sla_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sla_settings_admin_all" ON public.vendor_sla_settings;
CREATE POLICY "sla_settings_admin_all" ON public.vendor_sla_settings
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP TRIGGER IF EXISTS trg_vendor_sla_settings_updated ON public.vendor_sla_settings;
CREATE TRIGGER trg_vendor_sla_settings_updated BEFORE UPDATE ON public.vendor_sla_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.order_vendor_sla_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sub_order_id uuid REFERENCES public.sub_orders(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('not_viewed','not_confirmed','not_shipped','critical_escalation')),
  severity text NOT NULL CHECK (severity IN ('warning','critical')) DEFAULT 'warning',
  hours_overdue numeric(6,2) NOT NULL DEFAULT 0,
  threshold_hours integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notified_vendor_at timestamptz,
  notified_admin_at timestamptz,
  notified_slack_at timestamptz,
  resolved_at timestamptz,
  resolved_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_order_id, alert_type)
);
CREATE INDEX IF NOT EXISTS idx_sla_alerts_open ON public.order_vendor_sla_alerts(severity, created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sla_alerts_vendor ON public.order_vendor_sla_alerts(vendor_id, created_at DESC);
ALTER TABLE public.order_vendor_sla_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sla_alerts_admin_all" ON public.order_vendor_sla_alerts;
CREATE POLICY "sla_alerts_admin_all" ON public.order_vendor_sla_alerts
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "sla_alerts_vendor_read_own" ON public.order_vendor_sla_alerts;
CREATE POLICY "sla_alerts_vendor_read_own" ON public.order_vendor_sla_alerts
  FOR SELECT TO authenticated USING (vendor_id = public.current_vendor_id());

-- 5) OVERVIEW VIEW
CREATE OR REPLACE VIEW public.admin_orders_sla_overview_v
WITH (security_invoker = true) AS
SELECT a.id AS alert_id, a.alert_type, a.severity, a.hours_overdue, a.threshold_hours,
  a.created_at AS alert_created_at, a.resolved_at,
  o.id AS order_id, o.order_number, o.status AS order_status, o.total_incl_vat, o.created_at AS order_created_at,
  so.id AS sub_order_id, so.status AS sub_order_status,
  so.vendor_first_viewed_at, so.vendor_confirmed_at, so.shipped_at,
  v.id AS vendor_id, v.company_name AS vendor_name, v.slug AS vendor_slug,
  c.company_name AS buyer_name
FROM public.order_vendor_sla_alerts a
LEFT JOIN public.orders o ON o.id = a.order_id
LEFT JOIN public.sub_orders so ON so.id = a.sub_order_id
LEFT JOIN public.vendors v ON v.id = a.vendor_id
LEFT JOIN public.customers c ON c.id = o.customer_id
WHERE o.hidden_from_list = false;

-- 6) RPC
CREATE OR REPLACE FUNCTION public.admin_sla_open_alerts_count()
RETURNS TABLE(total bigint, warnings bigint, criticals bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT count(*)::bigint, count(*) FILTER (WHERE severity = 'warning')::bigint,
         count(*) FILTER (WHERE severity = 'critical')::bigint
  FROM public.order_vendor_sla_alerts WHERE resolved_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.admin_sla_open_alerts_count() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_sla_open_alerts_count() TO authenticated;
