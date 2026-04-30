CREATE OR REPLACE FUNCTION public.rfq_dispatch(_rfq_id uuid)
RETURNS TABLE(vendor_id uuid, reason rfq_target_reason, was_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- Top N scoré (cap RFQ ou défaut système, fallback si trop peu de candidats)
    SELECT t.vendor_id, t.reason
    FROM public.rfq_select_top_vendors(_rfq_id) t
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
$function$;
