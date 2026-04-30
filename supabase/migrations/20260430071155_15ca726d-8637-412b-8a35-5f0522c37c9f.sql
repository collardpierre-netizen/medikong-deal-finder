-- ============================================================
-- RFQ Routing Engine
-- ============================================================

ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_targeted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_responded integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfq_dispatch_status') THEN
    CREATE TYPE public.rfq_dispatch_status AS ENUM (
      'dispatched', 'viewed', 'reminded', 'responded', 'declined', 'expired'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfq_target_reason') THEN
    CREATE TYPE public.rfq_target_reason AS ENUM (
      'product_offer', 'brand_interest', 'manufacturer_interest', 'product_interest', 'manual'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.rfq_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  status public.rfq_dispatch_status NOT NULL DEFAULT 'dispatched',
  reason public.rfq_target_reason NOT NULL,
  notification_id uuid REFERENCES public.vendor_notifications(id) ON DELETE SET NULL,
  email_message_id text,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  email_opened_at timestamptz,
  email_clicked_at timestamptz,
  viewed_at timestamptz,
  reminded_at timestamptz,
  responded_at timestamptz,
  declined_at timestamptz,
  expired_at timestamptz,
  decline_reason text,
  tracking_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_dispatch_rfq ON public.rfq_dispatch_log(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_dispatch_vendor ON public.rfq_dispatch_log(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_rfq_dispatch_token ON public.rfq_dispatch_log(tracking_token);
CREATE INDEX IF NOT EXISTS idx_rfq_dispatch_pending ON public.rfq_dispatch_log(rfq_id) WHERE status IN ('dispatched','viewed','reminded');

DROP TRIGGER IF EXISTS trg_rfq_dispatch_updated_at ON public.rfq_dispatch_log;
CREATE TRIGGER trg_rfq_dispatch_updated_at
  BEFORE UPDATE ON public.rfq_dispatch_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.rfq_dispatch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers see dispatch of their own RFQs" ON public.rfq_dispatch_log;
CREATE POLICY "Buyers see dispatch of their own RFQs"
  ON public.rfq_dispatch_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rfqs r
      WHERE r.id = rfq_dispatch_log.rfq_id
        AND r.buyer_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors see their own dispatch lines" ON public.rfq_dispatch_log;
CREATE POLICY "Vendors see their own dispatch lines"
  ON public.rfq_dispatch_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = rfq_dispatch_log.vendor_id
        AND v.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage all dispatch" ON public.rfq_dispatch_log;
CREATE POLICY "Admins manage all dispatch"
  ON public.rfq_dispatch_log FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.rfq_resolve_target_vendors(_rfq_id uuid)
RETURNS TABLE (vendor_id uuid, reason public.rfq_target_reason)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rfq record;
BEGIN
  SELECT id, product_id, brand_id
  INTO _rfq
  FROM public.rfqs
  WHERE id = _rfq_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH product_vendors AS (
    SELECT DISTINCT o.vendor_id, 'product_offer'::public.rfq_target_reason AS reason
    FROM public.offers o
    WHERE _rfq.product_id IS NOT NULL
      AND o.product_id = _rfq.product_id
      AND o.is_active = true
  ),
  brand_id_resolved AS (
    SELECT COALESCE(_rfq.brand_id, p.brand_id) AS brand_id,
           p.manufacturer_id
    FROM public.products p
    WHERE p.id = _rfq.product_id
    UNION ALL
    SELECT _rfq.brand_id, NULL::uuid
    WHERE _rfq.product_id IS NULL AND _rfq.brand_id IS NOT NULL
  ),
  brand_interests AS (
    SELECT DISTINCT vci.vendor_id, 'brand_interest'::public.rfq_target_reason AS reason
    FROM public.vendor_catalog_interests vci
    JOIN brand_id_resolved b ON b.brand_id IS NOT NULL AND vci.brand_id = b.brand_id
    WHERE vci.brand_id IS NOT NULL
  ),
  manufacturer_interests AS (
    SELECT DISTINCT vci.vendor_id, 'manufacturer_interest'::public.rfq_target_reason AS reason
    FROM public.vendor_catalog_interests vci
    JOIN brand_id_resolved b ON b.manufacturer_id IS NOT NULL AND vci.manufacturer_id = b.manufacturer_id
    WHERE vci.manufacturer_id IS NOT NULL
  ),
  product_interests AS (
    SELECT DISTINCT vci.vendor_id, 'product_interest'::public.rfq_target_reason AS reason
    FROM public.vendor_catalog_interests vci
    WHERE _rfq.product_id IS NOT NULL AND vci.product_id = _rfq.product_id
  ),
  unioned AS (
    SELECT * FROM product_vendors
    UNION ALL SELECT * FROM brand_interests
    UNION ALL SELECT * FROM manufacturer_interests
    UNION ALL SELECT * FROM product_interests
  ),
  ranked AS (
    SELECT u.vendor_id, u.reason,
           ROW_NUMBER() OVER (
             PARTITION BY u.vendor_id
             ORDER BY CASE u.reason
               WHEN 'product_offer' THEN 1
               WHEN 'product_interest' THEN 2
               WHEN 'brand_interest' THEN 3
               WHEN 'manufacturer_interest' THEN 4
               ELSE 5 END
           ) AS rn
    FROM unioned u
    JOIN public.vendors v ON v.id = u.vendor_id
    WHERE COALESCE(v.is_active, true) = true
  )
  SELECT r.vendor_id, r.reason FROM ranked r WHERE r.rn = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.rfq_dispatch(_rfq_id uuid)
RETURNS TABLE (vendor_id uuid, reason public.rfq_target_reason, was_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rfq record;
  _total int := 0;
BEGIN
  SELECT id, buyer_user_id, product_id, brand_id, status
  INTO _rfq
  FROM public.rfqs
  WHERE id = _rfq_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RFQ % not found', _rfq_id;
  END IF;

  IF _rfq.buyer_user_id <> auth.uid()
     AND NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to dispatch this RFQ';
  END IF;

  RETURN QUERY
  WITH targets AS (
    SELECT t.vendor_id, t.reason
    FROM public.rfq_resolve_target_vendors(_rfq_id) t
  ),
  inserted AS (
    INSERT INTO public.rfq_dispatch_log (rfq_id, vendor_id, reason, status)
    SELECT _rfq_id, t.vendor_id, t.reason, 'dispatched'
    FROM targets t
    ON CONFLICT (rfq_id, vendor_id) DO NOTHING
    RETURNING vendor_id, reason
  ),
  notifs AS (
    INSERT INTO public.vendor_notifications (vendor_id, notification_type, title, message, payload)
    SELECT i.vendor_id,
           'rfq_received',
           'Nouvelle demande de prix',
           'Un acheteur sollicite un devis. Réponse attendue avant expiration.',
           jsonb_build_object('rfq_id', _rfq_id, 'reason', i.reason::text)
    FROM inserted i
    RETURNING id, vendor_id
  ),
  link AS (
    UPDATE public.rfq_dispatch_log d
    SET notification_id = n.id
    FROM notifs n
    WHERE d.rfq_id = _rfq_id AND d.vendor_id = n.vendor_id
    RETURNING d.vendor_id
  )
  SELECT t.vendor_id, t.reason,
         EXISTS (SELECT 1 FROM inserted i WHERE i.vendor_id = t.vendor_id) AS was_new
  FROM targets t;

  SELECT COUNT(*) INTO _total
  FROM public.rfq_dispatch_log WHERE rfq_id = _rfq_id;

  UPDATE public.rfqs
  SET dispatched_at = COALESCE(dispatched_at, now()),
      total_targeted = _total,
      status = CASE WHEN status = 'draft' THEN 'open' ELSE status END
  WHERE id = _rfq_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rfq_send_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int := 0;
BEGIN
  WITH eligible AS (
    SELECT d.id, d.rfq_id, d.vendor_id
    FROM public.rfq_dispatch_log d
    JOIN public.rfqs r ON r.id = d.rfq_id
    WHERE d.status IN ('dispatched','viewed')
      AND d.dispatched_at <= now() - interval '2 days'
      AND d.reminded_at IS NULL
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND r.status = 'open'
  ),
  upd AS (
    UPDATE public.rfq_dispatch_log d
    SET status = 'reminded', reminded_at = now()
    FROM eligible e
    WHERE d.id = e.id
    RETURNING d.id, d.vendor_id, d.rfq_id
  ),
  notifs AS (
    INSERT INTO public.vendor_notifications (vendor_id, notification_type, title, message, payload)
    SELECT u.vendor_id,
           'rfq_reminder',
           'Relance : demande de prix en attente',
           'Vous n''avez pas encore répondu à cette demande de prix.',
           jsonb_build_object('rfq_id', u.rfq_id)
    FROM upd u
    RETURNING id
  )
  SELECT COUNT(*) INTO _count FROM upd;

  UPDATE public.rfqs r
  SET last_reminded_at = now()
  WHERE EXISTS (
    SELECT 1 FROM public.rfq_dispatch_log d
    WHERE d.rfq_id = r.id AND d.reminded_at >= now() - interval '1 minute'
  );

  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rfq_close_expired()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int := 0;
BEGIN
  UPDATE public.rfq_dispatch_log d
  SET status = 'expired', expired_at = now()
  FROM public.rfqs r
  WHERE d.rfq_id = r.id
    AND r.expires_at IS NOT NULL
    AND r.expires_at <= now()
    AND d.status IN ('dispatched','viewed','reminded');

  WITH closed AS (
    UPDATE public.rfqs
    SET status = 'closed', closed_at = now()
    WHERE expires_at IS NOT NULL
      AND expires_at <= now()
      AND status = 'open'
    RETURNING id
  )
  SELECT COUNT(*) INTO _count FROM closed;

  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rfq_track_event(_token uuid, _event text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _event NOT IN ('email_opened','email_clicked','viewed') THEN
    RETURN false;
  END IF;

  UPDATE public.rfq_dispatch_log
  SET email_opened_at = CASE WHEN _event = 'email_opened' AND email_opened_at IS NULL THEN now() ELSE email_opened_at END,
      email_clicked_at = CASE WHEN _event = 'email_clicked' AND email_clicked_at IS NULL THEN now() ELSE email_clicked_at END,
      viewed_at = CASE WHEN _event IN ('email_clicked','viewed') AND viewed_at IS NULL THEN now() ELSE viewed_at END,
      status = CASE WHEN status = 'dispatched' AND _event IN ('email_clicked','viewed') THEN 'viewed' ELSE status END
  WHERE tracking_token = _token;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.rfq_on_response_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rfq_dispatch_log
  SET status = 'responded', responded_at = now()
  WHERE rfq_id = NEW.rfq_id AND vendor_id = NEW.vendor_id
    AND status <> 'responded';

  UPDATE public.rfqs
  SET total_responded = (
    SELECT COUNT(*) FROM public.rfq_dispatch_log
    WHERE rfq_id = NEW.rfq_id AND status = 'responded'
  )
  WHERE id = NEW.rfq_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rfq_response_dispatch_sync ON public.rfq_responses;
CREATE TRIGGER trg_rfq_response_dispatch_sync
  AFTER INSERT ON public.rfq_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.rfq_on_response_inserted();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('rfq-send-reminders-daily','rfq-close-expired-hourly');

    PERFORM cron.schedule(
      'rfq-send-reminders-daily',
      '0 9 * * *',
      $cron$ SELECT public.rfq_send_reminders(); $cron$
    );

    PERFORM cron.schedule(
      'rfq-close-expired-hourly',
      '15 * * * *',
      $cron$ SELECT public.rfq_close_expired(); $cron$
    );
  END IF;
END$$;

GRANT EXECUTE ON FUNCTION public.rfq_resolve_target_vendors(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rfq_dispatch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rfq_track_event(uuid, text) TO anon, authenticated;