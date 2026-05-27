-- Action center RPC: returns counts + last 10 items for sidebar bullets and header bell dropdown.
-- Scope = 'admin' | 'vendor' | 'buyer'. Counts are computed live (no "seen" state).

CREATE OR REPLACE FUNCTION public.get_action_center(_scope text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _vendor_id uuid;
  _is_admin boolean := false;
  _sections jsonb := '[]'::jsonb;
  _items jsonb := '[]'::jsonb;
  _total int := 0;
  _c_rfq int := 0;
  _c_kyc int := 0;
  _c_sub int := 0;
  _c_anom int := 0;
  _c_sec int := 0;
  _c_vn int := 0;
  _c_chal int := 0;
  _c_vrfq int := 0;
  _c_brfq int := 0;
  _c_bresp int := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('total', 0, 'sections', '[]'::jsonb, 'items', '[]'::jsonb);
  END IF;

  IF _scope = 'admin' THEN
    SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _uid AND is_active = true)
      INTO _is_admin;
    IF NOT _is_admin THEN
      RETURN jsonb_build_object('total', 0, 'sections', '[]'::jsonb, 'items', '[]'::jsonb);
    END IF;

    SELECT count(*) INTO _c_rfq FROM public.rfqs WHERE status IN ('dispatched','in_followup');
    SELECT count(*) INTO _c_kyc FROM public.vendors WHERE is_active = false AND is_verified = false;
    SELECT count(*) INTO _c_sub FROM public.product_submissions WHERE status = 'submitted';
    SELECT count(*) INTO _c_anom FROM public.product_category_anomalies WHERE status = 'open';
    SELECT count(*) INTO _c_sec FROM public.security_audit_logs
      WHERE severity = 'critical' AND created_at >= now() - interval '24 hours';

    _total := _c_rfq + _c_kyc + _c_sub + _c_anom + _c_sec;

    _sections := jsonb_build_array(
      jsonb_build_object('key','rfq','label','RFQ à traiter','count',_c_rfq,'href','/admin/rfq'),
      jsonb_build_object('key','kyc','label','Vendeurs à valider','count',_c_kyc,'href','/admin/vendeurs'),
      jsonb_build_object('key','submissions','label','Produits soumis','count',_c_sub,'href','/admin/produits-soumis'),
      jsonb_build_object('key','anomalies','label','Anomalies catégorie','count',_c_anom,'href','/admin/categories/anomalies'),
      jsonb_build_object('key','security','label','Audit critique (24h)','count',_c_sec,'href','/admin/contract-audit')
    );

    _items := (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT * FROM (
          SELECT 'rfq'::text AS type, ('RFQ #' || substr(id::text,1,8)) AS title,
                 ('Quantité ' || quantity || ' · statut ' || status) AS subtitle,
                 ('/admin/rfq?id=' || id) AS href, dispatched_at AS created_at
          FROM public.rfqs WHERE status IN ('dispatched','in_followup')
          ORDER BY dispatched_at DESC NULLS LAST LIMIT 5
        ) a
        UNION ALL
        SELECT * FROM (
          SELECT 'kyc'::text, coalesce(name, 'Vendeur'), 'KYC en attente',
                 '/admin/vendeurs?vendor=' || id, created_at
          FROM public.vendors WHERE is_active = false AND is_verified = false
          ORDER BY created_at DESC NULLS LAST LIMIT 5
        ) b
        UNION ALL
        SELECT * FROM (
          SELECT 'submission'::text,
                 coalesce(proposed_payload->>'proposed_name', 'Produit proposé'),
                 'Soumission vendeur', '/admin/produits-soumis?id=' || id, created_at
          FROM public.product_submissions WHERE status = 'submitted'
          ORDER BY created_at DESC LIMIT 5
        ) c
        UNION ALL
        SELECT * FROM (
          SELECT 'security'::text, ('Audit critique : ' || action),
                 coalesce(actor_email, category), '/admin/contract-audit', created_at
          FROM public.security_audit_logs
          WHERE severity = 'critical' AND created_at >= now() - interval '24 hours'
          ORDER BY created_at DESC LIMIT 5
        ) d
        ORDER BY created_at DESC NULLS LAST
        LIMIT 10
      ) t
    );

  ELSIF _scope = 'vendor' THEN
    SELECT id INTO _vendor_id FROM public.vendors WHERE auth_user_id = _uid LIMIT 1;
    IF _vendor_id IS NULL THEN
      RETURN jsonb_build_object('total', 0, 'sections', '[]'::jsonb, 'items', '[]'::jsonb);
    END IF;

    SELECT count(*) INTO _c_vrfq
      FROM public.rfq_dispatch_log dl
      JOIN public.rfqs r ON r.id = dl.rfq_id
      WHERE dl.vendor_id = _vendor_id
        AND dl.status IN ('dispatched','viewed','pending_review','reminded')
        AND r.status IN ('dispatched','in_followup');

    SELECT count(*) INTO _c_vn FROM public.vendor_notifications
      WHERE vendor_id = _vendor_id AND read_at IS NULL;

    SELECT count(*) INTO _c_chal FROM public.vendor_price_challenges
      WHERE vendor_id = _vendor_id AND responded_at IS NULL;

    _total := _c_vrfq + _c_vn + _c_chal;

    _sections := jsonb_build_array(
      jsonb_build_object('key','rfq','label','RFQ reçus','count',_c_vrfq,'href','/vendor/rfq'),
      jsonb_build_object('key','notifications','label','Notifications','count',_c_vn,'href','/vendor/notifications'),
      jsonb_build_object('key','challenges','label','Challenges prix','count',_c_chal,'href','/vendor/offers')
    );

    _items := (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT * FROM (
          SELECT 'rfq'::text AS type, ('RFQ #' || substr(r.id::text,1,8)) AS title,
                 ('Quantité ' || r.quantity) AS subtitle,
                 ('/vendor/rfq?id=' || r.id) AS href, coalesce(dl.dispatched_at, dl.created_at) AS created_at
          FROM public.rfq_dispatch_log dl
          JOIN public.rfqs r ON r.id = dl.rfq_id
          WHERE dl.vendor_id = _vendor_id
            AND dl.status IN ('dispatched','viewed','pending_review','reminded')
            AND r.status IN ('dispatched','in_followup')
          ORDER BY coalesce(dl.dispatched_at, dl.created_at) DESC LIMIT 5
        ) a
        UNION ALL
        SELECT * FROM (
          SELECT 'notification'::text, title, coalesce(body, type),
                 coalesce(cta_url, '/vendor/notifications'), created_at
          FROM public.vendor_notifications
          WHERE vendor_id = _vendor_id AND read_at IS NULL
          ORDER BY created_at DESC LIMIT 5
        ) b
        UNION ALL
        SELECT * FROM (
          SELECT 'challenge'::text, 'Challenge prix vendeur', coalesce(message, reason),
                 '/vendor/offers?product=' || product_id, created_at
          FROM public.vendor_price_challenges
          WHERE vendor_id = _vendor_id AND responded_at IS NULL
          ORDER BY created_at DESC LIMIT 5
        ) c
        ORDER BY created_at DESC NULLS LAST
        LIMIT 10
      ) t
    );

  ELSIF _scope = 'buyer' THEN
    SELECT count(*) INTO _c_brfq FROM public.rfqs
      WHERE buyer_user_id = _uid AND status IN ('dispatched','in_followup');

    SELECT count(*) INTO _c_bresp
      FROM public.rfq_responses rr
      JOIN public.rfqs r ON r.id = rr.rfq_id
      WHERE r.buyer_user_id = _uid
        AND rr.is_visible_to_buyer = true
        AND rr.awarded = false
        AND r.status IN ('dispatched','in_followup')
        AND rr.created_at >= now() - interval '14 days';

    _total := _c_brfq + _c_bresp;

    _sections := jsonb_build_array(
      jsonb_build_object('key','myRfq','label','Mes RFQ ouverts','count',_c_brfq,'href','/mes-rfq'),
      jsonb_build_object('key','responses','label','Nouvelles réponses','count',_c_bresp,'href','/mes-rfq')
    );

    _items := (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT * FROM (
          SELECT 'response'::text AS type,
                 ('Nouvelle réponse RFQ #' || substr(r.id::text,1,8)) AS title,
                 ('Prix HT ' || (rr.unit_price_excl_vat_cents::numeric / 100)::text || ' €') AS subtitle,
                 ('/mes-rfq?id=' || r.id) AS href, rr.created_at AS created_at
          FROM public.rfq_responses rr
          JOIN public.rfqs r ON r.id = rr.rfq_id
          WHERE r.buyer_user_id = _uid
            AND rr.is_visible_to_buyer = true
            AND rr.awarded = false
            AND r.status IN ('dispatched','in_followup')
            AND rr.created_at >= now() - interval '14 days'
          ORDER BY rr.created_at DESC LIMIT 7
        ) a
        UNION ALL
        SELECT * FROM (
          SELECT 'rfq'::text, ('Mon RFQ #' || substr(id::text,1,8)),
                 ('Statut ' || status), ('/mes-rfq?id=' || id), dispatched_at
          FROM public.rfqs
          WHERE buyer_user_id = _uid AND status IN ('dispatched','in_followup')
          ORDER BY dispatched_at DESC NULLS LAST LIMIT 5
        ) b
        ORDER BY created_at DESC NULLS LAST
        LIMIT 10
      ) t
    );
  ELSE
    RETURN jsonb_build_object('total', 0, 'sections', '[]'::jsonb, 'items', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object('total', _total, 'sections', _sections, 'items', _items);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_action_center(text) TO authenticated, service_role;