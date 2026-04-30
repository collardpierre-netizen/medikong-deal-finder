-- ============================================================================
-- RFQ Routing Audit Log
-- ============================================================================

CREATE TYPE public.rfq_routing_decision AS ENUM (
  'selected',   -- Retenu et notifié
  'excluded',   -- Filtré (raison serveur)
  'over_cap'    -- Éligible & scoré mais hors Top N
);

CREATE TABLE IF NOT EXISTS public.rfq_routing_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id          uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  vendor_id       uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  decision        public.rfq_routing_decision NOT NULL,
  reason_code     text NOT NULL,            -- ex: 'inactive','kyc_not_validated','rfq_opt_out','currency_not_accepted','country_not_served','capacity_full','no_stock','moq_too_high','no_targeting_match','top_n_selected','below_score_cap'
  reason_label    text,                     -- libellé FR lisible
  matched_reason  public.rfq_target_reason, -- product_offer / brand_interest / ...
  score           numeric,
  rank_position   integer,
  cap_applied     integer,
  details         jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_routing_audit_rfq      ON public.rfq_routing_audit_log(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_routing_audit_vendor   ON public.rfq_routing_audit_log(vendor_id);
CREATE INDEX IF NOT EXISTS idx_rfq_routing_audit_decision ON public.rfq_routing_audit_log(decision);

ALTER TABLE public.rfq_routing_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rfq_routing_audit_admin_read" ON public.rfq_routing_audit_log;
CREATE POLICY "rfq_routing_audit_admin_read"
  ON public.rfq_routing_audit_log FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "rfq_routing_audit_service_write" ON public.rfq_routing_audit_log;
CREATE POLICY "rfq_routing_audit_audit_write"
  ON public.rfq_routing_audit_log FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

COMMENT ON TABLE public.rfq_routing_audit_log IS
  'Journal d''audit : pour chaque RFQ × vendeur, raison de sélection/exclusion/hors-cap.';

-- ============================================================================
-- RPC d'audit : rejoue les filtres serveur + scoring et journalise
-- ============================================================================
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
  _cap            int;
  _default_cap    int;
  _min_floor      int;
  _candidates     int;
  _written        int := 0;
BEGIN
  SELECT id, product_id, brand_id, destination_country_code, currency_code,
         quantity, max_target_vendors
  INTO _rfq FROM public.rfqs WHERE id = _rfq_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  _buyer_country := COALESCE(_rfq.destination_country_code, 'BE');
  _currency      := COALESCE(_rfq.currency_code, 'EUR');
  _qty           := COALESCE(_rfq.quantity, 1);

  SELECT value_int INTO _default_cap FROM public.rfq_routing_settings WHERE key = 'default_max_target_vendors';
  SELECT value_int INTO _min_floor   FROM public.rfq_routing_settings WHERE key = 'min_target_vendors';
  _cap       := COALESCE(_rfq.max_target_vendors, _default_cap, 8);
  _min_floor := COALESCE(_min_floor, 3);

  -- Wipe ancien audit pour rejouer proprement
  DELETE FROM public.rfq_routing_audit_log WHERE rfq_id = _rfq_id;

  -- 1) Univers candidat : tous les vendeurs ayant matché au moins une cible (avant filtres serveur)
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
    FROM raw_candidates
    GROUP BY vendor_id
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
    SELECT
      br.vendor_id,
      br.reason AS matched_reason,
      v.is_active,
      v.validation_status::text AS kyc_status,
      COALESCE(v.accepts_rfq, true) AS accepts_rfq,
      v.accepted_currencies,
      v.ships_to_countries,
      v.country_code,
      v.max_open_rfqs,
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
  -- 2) Insert exclusions (avant scoring)
  INSERT INTO public.rfq_routing_audit_log
    (rfq_id, vendor_id, decision, reason_code, reason_label, matched_reason, cap_applied, details)
  SELECT
    _rfq_id, c.vendor_id, 'excluded'::public.rfq_routing_decision,
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
    c.matched_reason, _cap,
    jsonb_build_object(
      'kyc_status',           c.kyc_status,
      'accepts_rfq',          c.accepts_rfq,
      'accepted_currencies',  c.accepted_currencies,
      'ships_to_countries',   c.ships_to_countries,
      'vendor_country',       c.country_code,
      'open_count',           c.open_count,
      'max_open_rfqs',        c.max_open_rfqs,
      'has_stock',            c.has_stock,
      'moq_ok',               c.moq_ok,
      'rfq_currency',         _currency,
      'rfq_country',          _buyer_country,
      'rfq_quantity',         _qty
    )
  FROM classified c
  WHERE c.exclusion_code IS NOT NULL;

  -- 3) Scoring + cap : selected vs over_cap
  SELECT COUNT(*) INTO _candidates FROM public.rfq_score_target_vendors(_rfq_id);

  WITH scored AS (
    SELECT s.*,
           ROW_NUMBER() OVER (ORDER BY s.score DESC, s.vendor_id) AS rn
    FROM public.rfq_score_target_vendors(_rfq_id) s
  ),
  decided AS (
    SELECT s.*,
      CASE
        WHEN _candidates <= _min_floor THEN 'selected'
        WHEN s.rn <= _cap              THEN 'selected'
        ELSE 'over_cap'
      END AS dec
    FROM scored s
  )
  INSERT INTO public.rfq_routing_audit_log
    (rfq_id, vendor_id, decision, reason_code, reason_label,
     matched_reason, score, rank_position, cap_applied, details)
  SELECT
    _rfq_id, d.vendor_id, d.dec::public.rfq_routing_decision,
    CASE d.dec
      WHEN 'selected' THEN
        CASE WHEN _candidates <= _min_floor THEN 'fallback_below_floor' ELSE 'top_n_selected' END
      ELSE 'below_score_cap'
    END,
    CASE d.dec
      WHEN 'selected' THEN
        CASE WHEN _candidates <= _min_floor
             THEN 'Sélectionné (fallback : moins de candidats que le plancher)'
             ELSE 'Top ' || _cap || ' selon le score' END
      ELSE 'Hors Top ' || _cap || ' (score insuffisant)'
    END,
    d.reason, d.score, d.rn::int, _cap,
    jsonb_build_object(
      'score_response',     d.score_response,
      'score_latency',      d.score_latency,
      'score_price',        d.score_price,
      'score_availability', d.score_availability,
      'score_reason',       d.score_reason,
      'score_rating',       d.score_rating,
      'candidates_count',   _candidates,
      'min_floor',          _min_floor
    )
  FROM decided d
  ON CONFLICT (rfq_id, vendor_id) DO UPDATE SET
    decision      = EXCLUDED.decision,
    reason_code   = EXCLUDED.reason_code,
    reason_label  = EXCLUDED.reason_label,
    matched_reason= EXCLUDED.matched_reason,
    score         = EXCLUDED.score,
    rank_position = EXCLUDED.rank_position,
    cap_applied   = EXCLUDED.cap_applied,
    details       = EXCLUDED.details;

  SELECT COUNT(*) INTO _written FROM public.rfq_routing_audit_log WHERE rfq_id = _rfq_id;
  RETURN _written;
END;
$$;

COMMENT ON FUNCTION public.rfq_audit_routing(uuid) IS
  'Rejoue les filtres serveur + scoring pour une RFQ et journalise chaque décision (selected/excluded/over_cap).';

GRANT EXECUTE ON FUNCTION public.rfq_audit_routing(uuid) TO authenticated, service_role;

-- ============================================================================
-- Vue admin lisible
-- ============================================================================
CREATE OR REPLACE VIEW public.rfq_routing_audit_v
WITH (security_invoker = true) AS
SELECT
  a.id, a.rfq_id, a.vendor_id, a.decision, a.reason_code, a.reason_label,
  a.matched_reason, a.score, a.rank_position, a.cap_applied, a.details, a.created_at,
  v.name        AS vendor_name,
  v.company_name AS vendor_company,
  v.country_code AS vendor_country,
  r.status      AS rfq_status,
  r.created_at  AS rfq_created_at,
  r.product_id, r.brand_id, r.quantity, r.destination_country_code, r.currency_code
FROM public.rfq_routing_audit_log a
JOIN public.vendors v ON v.id = a.vendor_id
JOIN public.rfqs    r ON r.id = a.rfq_id;

COMMENT ON VIEW public.rfq_routing_audit_v IS
  'Vue admin du journal de routage : audit + nom vendeur + contexte RFQ. RLS héritée via security_invoker.';

-- ============================================================================
-- Branchement automatique : rfq_dispatch journalise après envoi
-- ============================================================================
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
  INTO _rfq FROM public.rfqs WHERE id = _rfq_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RFQ % not found', _rfq_id;
  END IF;

  IF _rfq.buyer_user_id <> auth.uid()
     AND NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to dispatch this RFQ';
  END IF;

  RETURN QUERY
  WITH targets AS (
    SELECT t.vendor_id, t.reason FROM public.rfq_select_top_vendors(_rfq_id) t
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
    SELECT i.vendor_id, 'rfq_received', 'Nouvelle demande de prix',
           'Un acheteur sollicite un devis. Connectez-vous à votre portail vendeur pour répondre avant expiration.',
           '/vendor/rfq/' || _rfq_id::text,
           jsonb_build_object(
             'rfq_id', _rfq_id, 'reason', i.reason::text,
             'product_id', _rfq.product_id, 'brand_id', _rfq.brand_id,
             'quantity', _rfq.quantity, 'country', _rfq.destination_country_code,
             'deadline', _rfq.responses_deadline)
    FROM inserted i RETURNING id, vendor_id
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

  SELECT COUNT(*) INTO _total FROM public.rfq_dispatch_log WHERE rfq_id = _rfq_id;

  UPDATE public.rfqs
  SET dispatched_at = COALESCE(dispatched_at, now()),
      total_targeted = _total,
      status = CASE WHEN status = 'draft' THEN 'open' ELSE status END
  WHERE id = _rfq_id;

  -- Journal d'audit du routage (best-effort, n'interrompt pas le dispatch)
  BEGIN
    PERFORM public.rfq_audit_routing(_rfq_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'rfq_audit_routing failed for %: %', _rfq_id, SQLERRM;
  END;
END;
$function$;
