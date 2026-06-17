
-- 1) Tables
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  cta_url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX admin_notifications_dedupe_uq
  ON public.admin_notifications(source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX admin_notifications_created_idx
  ON public.admin_notifications(created_at DESC);

GRANT SELECT ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_notifications_admin_read"
  ON public.admin_notifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users
                 WHERE user_id = auth.uid() AND is_active = true));

CREATE TABLE public.admin_notification_reads (
  notification_id uuid NOT NULL REFERENCES public.admin_notifications(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, admin_user_id)
);
CREATE INDEX admin_notification_reads_user_idx
  ON public.admin_notification_reads(admin_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notification_reads TO authenticated;
GRANT ALL ON public.admin_notification_reads TO service_role;
ALTER TABLE public.admin_notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_notification_reads_own"
  ON public.admin_notification_reads FOR ALL TO authenticated
  USING (admin_user_id = auth.uid())
  WITH CHECK (admin_user_id = auth.uid());

-- 2) Helper interne
CREATE OR REPLACE FUNCTION public.create_admin_notification(
  _type text, _severity text, _title text, _body text, _cta_url text,
  _source_type text, _source_id uuid, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_notifications
    (type, severity, title, body, cta_url, source_type, source_id, payload)
  VALUES (_type, _severity, _title, _body, _cta_url, _source_type, _source_id, COALESCE(_payload, '{}'::jsonb))
  ON CONFLICT (source_type, source_id) DO NOTHING;
END $$;

-- 3) RPCs
CREATE OR REPLACE FUNCTION public.admin_notifications_list(
  _limit int DEFAULT 100, _only_unread boolean DEFAULT false
) RETURNS TABLE(
  id uuid, type text, severity text, title text, body text, cta_url text,
  payload jsonb, source_type text, source_id uuid,
  created_at timestamptz, read_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT n.id, n.type, n.severity, n.title, n.body, n.cta_url, n.payload,
         n.source_type, n.source_id, n.created_at, r.read_at
  FROM public.admin_notifications n
  LEFT JOIN public.admin_notification_reads r
    ON r.notification_id = n.id AND r.admin_user_id = auth.uid()
  WHERE EXISTS (SELECT 1 FROM public.admin_users
                WHERE user_id = auth.uid() AND is_active = true)
    AND (NOT _only_unread OR r.read_at IS NULL)
  ORDER BY n.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
$$;

CREATE OR REPLACE FUNCTION public.admin_notifications_unread_count()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(count(*), 0)::int
  FROM public.admin_notifications n
  LEFT JOIN public.admin_notification_reads r
    ON r.notification_id = n.id AND r.admin_user_id = auth.uid()
  WHERE EXISTS (SELECT 1 FROM public.admin_users
                WHERE user_id = auth.uid() AND is_active = true)
    AND r.read_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.admin_notifications_mark_read(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.admin_notification_reads(notification_id, admin_user_id)
  VALUES (_id, auth.uid())
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.admin_notifications_mark_all_read()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.admin_notification_reads(notification_id, admin_user_id)
  SELECT n.id, auth.uid()
  FROM public.admin_notifications n
  LEFT JOIN public.admin_notification_reads r
    ON r.notification_id = n.id AND r.admin_user_id = auth.uid()
  WHERE r.read_at IS NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _c = ROW_COUNT;
  RETURN _c;
END $$;

-- 4) Triggers sources
CREATE OR REPLACE FUNCTION public.trg_admin_notif_vendor_kyc() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.is_active,false) = false AND COALESCE(NEW.is_verified,false) = false THEN
    PERFORM public.create_admin_notification(
      'vendor_kyc','warning',
      'Nouveau vendeur à valider', COALESCE(NEW.name,'Vendeur'),
      '/admin/vendeurs?vendor=' || NEW.id::text,
      'vendor_kyc', NEW.id, '{}'::jsonb);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_admin_notif_vendor_kyc_ai
AFTER INSERT ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_notif_vendor_kyc();

CREATE OR REPLACE FUNCTION public.trg_admin_notif_submission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'submitted' THEN
    PERFORM public.create_admin_notification(
      'product_submission','info',
      'Nouvelle soumission produit',
      COALESCE(NEW.proposed_payload->>'proposed_name','Produit proposé'),
      '/admin/produits-soumis?id=' || NEW.id::text,
      'product_submission', NEW.id, '{}'::jsonb);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_admin_notif_submission_ai
AFTER INSERT ON public.product_submissions
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_notif_submission();

CREATE OR REPLACE FUNCTION public.trg_admin_notif_sub_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM public.create_admin_notification(
      'order','info',
      'Nouvelle commande à traiter',
      'Sub-order ' || substr(NEW.id::text,1,8),
      '/admin/commandes',
      'sub_order', NEW.id, '{}'::jsonb);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_admin_notif_sub_order_ai
AFTER INSERT ON public.sub_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_notif_sub_order();

CREATE OR REPLACE FUNCTION public.trg_admin_notif_sla() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_admin_notification(
    'sla_alert',
    CASE WHEN NEW.severity = 'critical' THEN 'critical' ELSE 'warning' END,
    'Commande en retard',
    NEW.alert_type || ' · +' || COALESCE(round(NEW.hours_overdue)::text,'?') || 'h',
    '/admin/commandes-en-retard',
    'sla_alert', NEW.id, '{}'::jsonb);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_admin_notif_sla_ai
AFTER INSERT ON public.order_vendor_sla_alerts
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_notif_sla();

CREATE OR REPLACE FUNCTION public.trg_admin_notif_security() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.severity = 'critical' THEN
    PERFORM public.create_admin_notification(
      'security','critical',
      'Audit critique : ' || NEW.action,
      COALESCE(NEW.actor_email, NEW.category),
      '/admin/contract-audit',
      'security', NEW.id, '{}'::jsonb);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_admin_notif_security_ai
AFTER INSERT ON public.security_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_notif_security();

CREATE OR REPLACE FUNCTION public.trg_admin_notif_rfq() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('dispatched','in_followup')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.create_admin_notification(
      'rfq','info',
      'RFQ à suivre #' || substr(NEW.id::text,1,8),
      'Statut ' || NEW.status,
      '/admin/rfq?id=' || NEW.id::text,
      'rfq', NEW.id, '{}'::jsonb);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_admin_notif_rfq_aiu
AFTER INSERT OR UPDATE OF status ON public.rfqs
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_notif_rfq();
