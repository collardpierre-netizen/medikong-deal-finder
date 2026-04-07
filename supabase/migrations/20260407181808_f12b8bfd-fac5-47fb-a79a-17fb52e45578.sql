
-- Enum types for price alerts
CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE public.alert_status AS ENUM ('new', 'seen', 'in_progress', 'resolved', 'auto_resolved');
CREATE TYPE public.alert_type AS ENUM ('market_price', 'external_offer');
CREATE TYPE public.notification_channel AS ENUM ('in_app', 'email', 'push');
CREATE TYPE public.notification_sender AS ENUM ('system', 'superadmin');
CREATE TYPE public.adjustment_trigger AS ENUM ('manual', 'quick_align', 'auto_align');
CREATE TYPE public.email_frequency AS ENUM ('immediate', 'daily_digest', 'weekly_digest');

-- 1. price_alerts
CREATE TABLE public.price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  alert_type alert_type NOT NULL,
  reference_price numeric NOT NULL,
  best_medikong_price numeric NOT NULL,
  gap_percentage numeric NOT NULL DEFAULT 0,
  gap_amount numeric NOT NULL DEFAULT 0,
  severity alert_severity NOT NULL DEFAULT 'info',
  status alert_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage price_alerts" ON public.price_alerts FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE INDEX idx_price_alerts_product ON public.price_alerts(product_id);
CREATE INDEX idx_price_alerts_severity ON public.price_alerts(severity);
CREATE INDEX idx_price_alerts_status ON public.price_alerts(status);
CREATE INDEX idx_price_alerts_created ON public.price_alerts(created_at DESC);

-- 2. price_alert_vendors
CREATE TABLE public.price_alert_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.price_alerts(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_price numeric NOT NULL,
  suggested_price numeric,
  vendor_gap_percentage numeric NOT NULL DEFAULT 0,
  notification_sent boolean NOT NULL DEFAULT false,
  notification_sent_at timestamptz,
  notification_read_at timestamptz,
  price_adjusted boolean NOT NULL DEFAULT false,
  price_adjusted_at timestamptz,
  old_price numeric,
  new_price numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_alert_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage price_alert_vendors" ON public.price_alert_vendors FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Vendors read own alert_vendors" ON public.price_alert_vendors FOR SELECT TO authenticated USING (vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid()));

CREATE INDEX idx_pav_alert ON public.price_alert_vendors(alert_id);
CREATE INDEX idx_pav_vendor ON public.price_alert_vendors(vendor_id);

-- 3. price_alert_settings
CREATE TABLE public.price_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage price_alert_settings" ON public.price_alert_settings FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Insert default settings
INSERT INTO public.price_alert_settings (setting_key, setting_value) VALUES
  ('info_threshold', '0'),
  ('warning_threshold', '5'),
  ('critical_threshold', '15'),
  ('competitive_margin', '1'),
  ('auto_notify_info', 'false'),
  ('auto_notify_warning', 'false'),
  ('auto_notify_critical', 'true'),
  ('escalation_hours', '48'),
  ('superadmin_report_frequency', 'daily');

-- 4. price_alert_notifications
CREATE TABLE public.price_alert_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_vendor_id uuid NOT NULL REFERENCES public.price_alert_vendors(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  message_content text,
  sent_by notification_sender NOT NULL DEFAULT 'system'
);

ALTER TABLE public.price_alert_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage price_alert_notifications" ON public.price_alert_notifications FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Vendors read own notifications" ON public.price_alert_notifications FOR SELECT TO authenticated USING (
  alert_vendor_id IN (
    SELECT pav.id FROM price_alert_vendors pav
    JOIN vendors v ON v.id = pav.vendor_id
    WHERE v.auth_user_id = auth.uid()
  )
);

CREATE INDEX idx_pan_alert_vendor ON public.price_alert_notifications(alert_vendor_id);

-- 5. price_adjustment_log
CREATE TABLE public.price_adjustment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_price numeric NOT NULL,
  new_price numeric NOT NULL,
  trigger adjustment_trigger NOT NULL DEFAULT 'manual',
  alert_id uuid REFERENCES public.price_alerts(id) ON DELETE SET NULL,
  adjusted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_adjustment_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage price_adjustment_log" ON public.price_adjustment_log FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Vendors read own adjustments" ON public.price_adjustment_log FOR SELECT TO authenticated USING (vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid()));

CREATE INDEX idx_pal_vendor ON public.price_adjustment_log(vendor_id);
CREATE INDEX idx_pal_product ON public.price_adjustment_log(product_id);
CREATE INDEX idx_pal_alert ON public.price_adjustment_log(alert_id);

-- 6. vendor_notification_preferences
CREATE TABLE public.vendor_notification_preferences (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  email_frequency email_frequency NOT NULL DEFAULT 'daily_digest',
  min_severity alert_severity NOT NULL DEFAULT 'warning',
  push_enabled boolean NOT NULL DEFAULT true,
  auto_align_enabled boolean NOT NULL DEFAULT false,
  floor_price_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage vendor_notification_preferences" ON public.vendor_notification_preferences FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Vendors manage own preferences" ON public.vendor_notification_preferences FOR ALL TO authenticated USING (vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid())) WITH CHECK (vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_price_alerts_updated_at BEFORE UPDATE ON public.price_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vendor_notif_prefs_updated_at BEFORE UPDATE ON public.vendor_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for alerts (vendor notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_alert_vendors;
