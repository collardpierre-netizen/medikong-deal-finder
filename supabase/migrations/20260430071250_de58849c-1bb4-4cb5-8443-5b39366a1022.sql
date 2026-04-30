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
  SELECT id, buyer_user_id, product_id, brand_id, status, quantity,
         destination_country_code, responses_deadline
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
    INSERT INTO public.vendor_notifications (vendor_id, type, title, body, cta_url, payload)
    SELECT i.vendor_id,
           'rfq_received',
           'Nouvelle demande de prix',
           'Un acheteur sollicite un devis. Connectez-vous à votre portail vendeur pour répondre avant expiration.',
           '/vendor/rfq/' || _rfq_id::text,
           jsonb_build_object(
             'rfq_id', _rfq_id,
             'reason', i.reason::text,
             'product_id', _rfq.product_id,
             'brand_id', _rfq.brand_id,
             'quantity', _rfq.quantity,
             'country', _rfq.destination_country_code,
             'deadline', _rfq.responses_deadline
           )
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
    INSERT INTO public.vendor_notifications (vendor_id, type, title, body, cta_url, payload)
    SELECT u.vendor_id,
           'rfq_reminder',
           'Relance : demande de prix en attente',
           'Vous n''avez pas encore répondu à cette demande de prix.',
           '/vendor/rfq/' || u.rfq_id::text,
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