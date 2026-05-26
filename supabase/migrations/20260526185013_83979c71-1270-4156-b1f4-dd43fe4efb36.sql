-- ============================================================================
-- RFQ Broadcast + Admin console
-- 1) Remove Top-N cap from rfq_select_top_vendors (broadcast to all eligible)
-- 2) Update rfq_audit_routing to no longer emit over_cap
-- 3) Add manual_admin column on rfq_reminder_log
-- 4) New admin RPCs: add vendor, list eligible-not-targeted, send reminder now
-- ============================================================================

-- 1) Broadcast: rfq_select_top_vendors renvoie TOUS les candidats éligibles.
DROP FUNCTION IF EXISTS public.rfq_select_top_vendors(uuid);
CREATE OR REPLACE FUNCTION public.rfq_select_top_vendors(_rfq_id uuid)
RETURNS TABLE(
  vendor_id uuid,
  reason    public.rfq_target_reason,
  score     numeric,
  rank_pos  int
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Broadcast policy : on retourne TOUS les candidats éligibles (scoring conservé
  -- uniquement pour l'affichage admin et l'ordre). Le cap historique
  -- (rfqs.max_target_vendors / rfq_routing_settings.default_max_target_vendors)
  -- est ignoré ici — il peut être ré-activé en remettant un LIMIT plus bas.
  RETURN QUERY
  SELECT s.vendor_id, s.reason, s.score,
         ROW_NUMBER() OVER (ORDER BY s.score DESC, s.vendor_id)::int
  FROM public.rfq_score_target_vendors(_rfq_id) s
  ORDER BY s.score DESC, s.vendor_id;
END;
$$;

COMMENT ON FUNCTION public.rfq_select_top_vendors(uuid) IS
  'Broadcast : renvoie TOUS les vendeurs éligibles scorés (cap Top N désactivé). Le score sert uniquement à l''ordre d''affichage admin.';

GRANT EXECUTE ON FUNCTION public.rfq_select_top_vendors(uuid) TO authenticated, service_role;

-- 2) rfq_audit_routing : tous les éligibles sont 'selected', plus de 'over_cap'.
DROP FUNCTION IF EXISTS public.rfq_audit_routing(uuid);
CREATE OR REPLACE FUNCTION public.rfq_audit_routing(_rfq_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rfq            record;
  _buyer_country  text;
  _currency       text;
  _qty            numeric;
  _candidates     int;
  _written        int := 0;
BEGIN
  SELECT id, product_id, brand_id, destination_country_code, currency_code, quantity
  INTO _rfq FROM public.rfqs WHERE id = _rfq_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  _buyer_country := COALESCE(_rfq.destination_country_code, 'BE');
  _currency      := COALESCE(_rfq.currency_code, 'EUR');
  _qty           := COALESCE(_rfq.quantity, 1);

  DELETE FROM public.rfq_routing_audit_log WHERE rfq_id = _rfq_id;

  WITH eligible_countries AS (
    SELECT country_code FROM public.rfq_eligible_vendor_countries(_buyer_country)
  ),
  brand_id_resolved AS (
    SELECT COALESCE(_rfq.brand_id, p.brand_id) AS brand_id, p.manufacturer_id
    FROM public.products p WHERE p.id = _rfq.product_id
    UNION ALL
    SELECT _rfq.brand_id, NULL::uuid
    WHERE _rfq.product_id IS NULL AND _rfq.brand_id IS NOT NULL
  ),
  raw_candidates AS (
    SELECT o.vendor_id, 'product_offer'::public.rfq_target_reason AS reason
      FROM public.offers o
      WHERE _rfq.product_id IS NOT NULL AND o.product_id = _rfq.product_id AND o.is_active = true
    UNION ALL
    SELECT vci.vendor_id, 'product_interest'::public.rfq_target_reason
      FROM public.vendor_catalog_interests vci
      WHERE _rfq.product_id IS NOT NULL AND vci.product_id = _rfq.product_id
    UNION ALL
    SELECT vci.vendor_id, 'brand_interest'::public.rfq_target_reason
      FROM public.vendor_catalog_interests vci
      JOIN brand_id_resolved b ON b.brand_id IS NOT NULL AND vci.brand_id = b.brand_id
    UNION ALL
    SELECT vci.vendor_id, 'manufacturer_interest'::public.rfq_target_reason
      FROM public.vendor_catalog_interests vci
      JOIN brand_id_resolved b ON b.manufacturer_id IS NOT NULL AND vci.manufacturer_id = b.manufacturer_id
    UNION ALL
    SELECT vci.vendor_id, 'category_interest'::public.rfq_target_reason
      FROM public.vendor_catalog_interests vci
      JOIN public.products p ON p.id = _rfq.product_id
      WHERE p.category_id IS NOT NULL AND vci.category_id = p.category_id
  ),
  best_reason AS (
    SELECT vendor_id,
           (ARRAY_AGG(reason ORDER BY CASE reason
              WHEN 'product_offer' THEN 1 WHEN 'product_interest' THEN 2
              WHEN 'brand_interest' THEN 3 WHEN 'manufacturer_interest' THEN 4
              WHEN 'category_interest' THEN 5 ELSE 6 END))[1] AS reason
    FROM raw_candidates GROUP BY vendor_id
  ),
  vendor_offer AS (
    SELECT o.vendor_id,
           bool_or(o.stock_quantity IS NULL OR o.stock_quantity >= _qty) AS has_stock,
           bool_or(o.moq IS NULL OR o.moq <= _qty)                       AS moq_ok
    FROM public.offers o
    WHERE _rfq.product_id IS NOT NULL AND o.product_id = _rfq.product_id AND o.is_active = true
    GROUP BY o.vendor_id
  ),
  evaluated AS (
    SELECT br.vendor_id, br.reason AS matched_reason,
      v.is_active, v.validation_status::text AS kyc_status,
      COALESCE(v.accepts_rfq, true) AS accepts_rfq,
      v.accepted_currencies, v.ships_to_countries, v.country_code, v.max_open_rfqs,
      public.rfq_vendor_open_count(v.id) AS open_count,
      vo.has_stock, vo.moq_ok,
      EXISTS (SELECT 1 FROM eligible_countries ec WHERE ec.country_code = v.country_code) AS country_neighbor_ok
    FROM best_reason br
    JOIN public.vendors v ON v.id = br.vendor_id
    LEFT JOIN vendor_offer vo ON vo.vendor_id = br.vendor_id
  ),
  classified AS (
    SELECT e.*,
      CASE
        WHEN COALESCE(e.is_active, true) = false              THEN 'inactive'
        WHEN e.kyc_status NOT IN ('accepted','approved')      THEN 'kyc_not_validated'
        WHEN e.accepts_rfq = false                            THEN 'rfq_opt_out'
        WHEN e.accepted_currencies IS NOT NULL
             AND array_length(e.accepted_currencies, 1) IS NOT NULL
             AND NOT (_currency = ANY(e.accepted_currencies)) THEN 'currency_not_accepted'
        WHEN array_length(e.ships_to_countries, 1) IS NOT NULL
             AND NOT (_buyer_country = ANY(e.ships_to_countries)) THEN 'country_not_served'
        WHEN (e.ships_to_countries IS NULL OR array_length(e.ships_to_countries, 1) IS NULL)
             AND e.country_code IS NOT NULL
             AND NOT e.country_neighbor_ok                    THEN 'country_not_served'
        WHEN e.max_open_rfqs IS NOT NULL
             AND e.open_count >= e.max_open_rfqs              THEN 'capacity_full'
        WHEN e.matched_reason = 'product_offer'
             AND COALESCE(e.has_stock, true) = false          THEN 'no_stock'
        WHEN e.matched_reason = 'product_offer'
             AND COALESCE(e.moq_ok, true) = false             THEN 'moq_too_high'
        ELSE NULL
      END AS exclusion_code
    FROM evaluated e
  )
  INSERT INTO public.rfq_routing_audit_log
    (rfq_id, vendor_id, decision, reason_code, reason_label, matched_reason, details)
  SELECT _rfq_id, c.vendor_id, 'excluded'::public.rfq_routing_decision,
    c.exclusion_code,
    CASE c.exclusion_code
      WHEN 'inactive'              THEN 'Vendeur désactivé'
      WHEN 'kyc_not_validated'     THEN 'KYC non validé'
      WHEN 'rfq_opt_out'           THEN 'Vendeur ne reçoit pas de RFQ (opt-out)'
      WHEN 'currency_not_accepted' THEN 'Devise non acceptée'
      WHEN 'country_not_served'    THEN 'Pays de livraison non couvert'
      WHEN 'capacity_full'         THEN 'Capacité RFQ ouverte atteinte'
      WHEN 'no_stock'              THEN 'Stock insuffisant pour la quantité demandée'
      WHEN 'moq_too_high'          THEN 'MOQ supérieur à la quantité demandée'
      ELSE c.exclusion_code
    END,
    c.matched_reason,
    jsonb_build_object(
      'kyc_status', c.kyc_status, 'accepts_rfq', c.accepts_rfq,
      'accepted_currencies', c.accepted_currencies,
      'ships_to_countries', c.ships_to_countries, 'vendor_country', c.country_code,
      'open_count', c.open_count, 'max_open_rfqs', c.max_open_rfqs,
      'has_stock', c.has_stock, 'moq_ok', c.moq_ok,
      'rfq_currency', _currency, 'rfq_country', _buyer_country, 'rfq_quantity', _qty
    )
  FROM classified c
  WHERE c.exclusion_code IS NOT NULL;

  -- Broadcast : tous les vendeurs scorés (= éligibles) sont 'selected'.
  SELECT COUNT(*) INTO _candidates FROM public.rfq_score_target_vendors(_rfq_id);

  INSERT INTO public.rfq_routing_audit_log
    (rfq_id, vendor_id, decision, reason_code, reason_label,
     matched_reason, score, rank_position, details)
  SELECT _rfq_id, s.vendor_id, 'selected'::public.rfq_routing_decision,
    'broadcast_selected', 'Sélectionné (broadcast à tous les éligibles)',
    s.reason, s.score,
    ROW_NUMBER() OVER (ORDER BY s.score DESC, s.vendor_id)::int,
    jsonb_build_object(
      'score_response', s.score_response, 'score_latency', s.score_latency,
      'score_price', s.score_price, 'score_availability', s.score_availability,
      'score_reason', s.score_reason, 'score_rating', s.score_rating,
      'candidates_count', _candidates
    )
  FROM public.rfq_score_target_vendors(_rfq_id) s
  ON CONFLICT (rfq_id, vendor_id) DO UPDATE SET
    decision      = EXCLUDED.decision,
    reason_code   = EXCLUDED.reason_code,
    reason_label  = EXCLUDED.reason_label,
    matched_reason= EXCLUDED.matched_reason,
    score         = EXCLUDED.score,
    rank_position = EXCLUDED.rank_position,
    details       = EXCLUDED.details;

  SELECT COUNT(*) INTO _written FROM public.rfq_routing_audit_log WHERE rfq_id = _rfq_id;
  RETURN _written;
END;
$$;

COMMENT ON FUNCTION public.rfq_audit_routing(uuid) IS
  'Audit broadcast : rejoue filtres + scoring et journalise selected/excluded (plus de over_cap).';

GRANT EXECUTE ON FUNCTION public.rfq_audit_routing(uuid) TO authenticated, service_role;

-- 3) rfq_reminder_log : ajout flag manual_admin
ALTER TABLE public.rfq_reminder_log
  ADD COLUMN IF NOT EXISTS manual_admin boolean NOT NULL DEFAULT false;

-- 4a) RPC : lister les vendeurs éligibles non encore ciblés (pour picker admin)
CREATE OR REPLACE FUNCTION public.rfq_admin_eligible_vendors_not_targeted(_rfq_id uuid)
RETURNS TABLE(
  vendor_id uuid,
  vendor_name text,
  vendor_company text,
  vendor_country text,
  reason public.rfq_target_reason,
  score numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT s.vendor_id, v.name, v.company_name, v.country_code, s.reason, s.score
  FROM public.rfq_score_target_vendors(_rfq_id) s
  JOIN public.vendors v ON v.id = s.vendor_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.rfq_dispatch_log d
    WHERE d.rfq_id = _rfq_id AND d.vendor_id = s.vendor_id
  )
  ORDER BY s.score DESC, v.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rfq_admin_eligible_vendors_not_targeted(uuid)
  TO authenticated, service_role;

-- 4b) RPC : ajouter manuellement un vendeur à une RFQ déjà dispatchée
CREATE OR REPLACE FUNCTION public.rfq_admin_add_vendor(
  _rfq_id uuid,
  _vendor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_eligible boolean;
  _reason public.rfq_target_reason;
  _notif_id uuid;
  _was_new boolean;
  _rfq record;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id, product_id, brand_id, quantity, destination_country_code, responses_deadline
  INTO _rfq FROM public.rfqs WHERE id = _rfq_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RFQ % not found', _rfq_id;
  END IF;

  -- Vérifie éligibilité via le scorer (qui applique tous les filtres serveur)
  SELECT reason INTO _reason
  FROM public.rfq_score_target_vendors(_rfq_id)
  WHERE vendor_id = _vendor_id
  LIMIT 1;

  _is_eligible := _reason IS NOT NULL;

  IF NOT _is_eligible THEN
    RAISE EXCEPTION 'Vendor % does not pass eligibility filters for RFQ %', _vendor_id, _rfq_id
      USING ERRCODE = '22023';
  END IF;

  -- Insert idempotent dans dispatch log
  INSERT INTO public.rfq_dispatch_log (rfq_id, vendor_id, reason, status)
  VALUES (_rfq_id, _vendor_id, _reason, 'dispatched')
  ON CONFLICT (rfq_id, vendor_id) DO NOTHING
  RETURNING true INTO _was_new;

  _was_new := COALESCE(_was_new, false);

  IF _was_new THEN
    -- Notification vendeur
    INSERT INTO public.vendor_notifications (vendor_id, type, title, body, cta_url, payload)
    VALUES (_vendor_id, 'rfq_received', 'Nouvelle demande de prix',
            'Un acheteur sollicite un devis. Connectez-vous à votre portail vendeur pour répondre avant expiration.',
            '/vendor/rfq/' || _rfq_id::text,
            jsonb_build_object(
              'rfq_id', _rfq_id, 'reason', _reason::text,
              'product_id', _rfq.product_id, 'brand_id', _rfq.brand_id,
              'quantity', _rfq.quantity, 'country', _rfq.destination_country_code,
              'deadline', _rfq.responses_deadline,
              'added_by_admin', true))
    RETURNING id INTO _notif_id;

    UPDATE public.rfq_dispatch_log
      SET notification_id = _notif_id
      WHERE rfq_id = _rfq_id AND vendor_id = _vendor_id;

    -- Audit
    INSERT INTO public.rfq_routing_audit_log
      (rfq_id, vendor_id, decision, reason_code, reason_label, matched_reason, details)
    VALUES (_rfq_id, _vendor_id, 'selected', 'manual_admin',
            'Ajouté manuellement par un administrateur', _reason,
            jsonb_build_object('admin_user_id', auth.uid()))
    ON CONFLICT (rfq_id, vendor_id) DO UPDATE SET
      decision = 'selected', reason_code = 'manual_admin',
      reason_label = 'Ajouté manuellement par un administrateur';

    -- Bump total_targeted
    UPDATE public.rfqs SET total_targeted = (
      SELECT COUNT(*) FROM public.rfq_dispatch_log WHERE rfq_id = _rfq_id
    ) WHERE id = _rfq_id;
  END IF;

  RETURN jsonb_build_object(
    'rfq_id', _rfq_id,
    'vendor_id', _vendor_id,
    'was_new', _was_new,
    'reason', _reason,
    'notification_id', _notif_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rfq_admin_add_vendor(uuid, uuid)
  TO authenticated, service_role;

-- 4c) RPC : relance manuelle admin (bypass conditions temporelles)
CREATE OR REPLACE FUNCTION public.rfq_admin_send_reminder_now(
  _rfq_id uuid,
  _vendor_id uuid,
  _template_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dispatch record;
  _template record;
  _rfq record;
  _current_wave smallint;
  _next_wave smallint;
  _already_sent boolean;
  _notif_id uuid;
  _log_id uuid;
  _subject text;
  _body text;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _dispatch
  FROM public.rfq_dispatch_log
  WHERE rfq_id = _rfq_id AND vendor_id = _vendor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No dispatch row for rfq=% vendor=%', _rfq_id, _vendor_id;
  END IF;

  SELECT * INTO _template FROM public.rfq_reminder_templates WHERE id = _template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template % not found', _template_id;
  END IF;

  SELECT id, product_id, brand_id, quantity, responses_deadline, current_wave
  INTO _rfq FROM public.rfqs WHERE id = _rfq_id;

  _current_wave := COALESCE(_rfq.current_wave, 1);
  _next_wave := _current_wave;

  -- Dédup : si déjà loggé pour cette vague, retour silencieux
  SELECT EXISTS (
    SELECT 1 FROM public.rfq_reminder_log
    WHERE rfq_id = _rfq_id AND vendor_id = _vendor_id AND wave_number = _next_wave
  ) INTO _already_sent;

  IF _already_sent THEN
    RETURN jsonb_build_object('status', 'already_sent', 'wave', _next_wave);
  END IF;

  -- Variables minimales (le pipeline render les {{...}})
  _subject := _template.subject_fr;
  _body := _template.body_fr;

  INSERT INTO public.vendor_notifications (vendor_id, type, title, body, cta_url, payload)
  VALUES (_vendor_id, 'rfq_reminder', _subject, _body,
          '/vendor/rfq/' || _rfq_id::text,
          jsonb_build_object(
            'rfq_id', _rfq_id, 'wave_number', _next_wave,
            'template_id', _template_id, 'manual_admin', true,
            'admin_user_id', auth.uid()))
  RETURNING id INTO _notif_id;

  INSERT INTO public.rfq_reminder_log
    (rfq_id, vendor_id, wave_number, template_id, email_message_id, manual_admin)
  VALUES (_rfq_id, _vendor_id, _next_wave, _template_id, _notif_id::text, true)
  RETURNING id INTO _log_id;

  UPDATE public.rfq_dispatch_log
    SET status = 'reminded'::public.rfq_dispatch_status,
        reminded_at = COALESCE(reminded_at, now())
    WHERE rfq_id = _rfq_id AND vendor_id = _vendor_id;

  RETURN jsonb_build_object(
    'status', 'sent',
    'wave', _next_wave,
    'notification_id', _notif_id,
    'log_id', _log_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rfq_admin_send_reminder_now(uuid, uuid, uuid)
  TO authenticated, service_role;