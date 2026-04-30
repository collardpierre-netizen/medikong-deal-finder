-- ============================================================================
-- RFQ Vendor Prioritization Strategy
-- ============================================================================

ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS max_target_vendors integer;

COMMENT ON COLUMN public.rfqs.max_target_vendors IS
  'Plafond du nombre de vendeurs contactés. NULL = utilise le défaut système.';

CREATE TABLE IF NOT EXISTS public.rfq_routing_settings (
  key text PRIMARY KEY,
  value_int integer,
  value_text text,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rfq_routing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rfq_routing_settings_admin_all" ON public.rfq_routing_settings;
CREATE POLICY "rfq_routing_settings_admin_all"
  ON public.rfq_routing_settings FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "rfq_routing_settings_read_authenticated" ON public.rfq_routing_settings;
CREATE POLICY "rfq_routing_settings_read_authenticated"
  ON public.rfq_routing_settings FOR SELECT
  USING (auth.role() = 'authenticated');

INSERT INTO public.rfq_routing_settings(key, value_int, description) VALUES
  ('default_max_target_vendors', 8,  'Plafond par défaut du nombre de vendeurs ciblés par RFQ'),
  ('min_target_vendors',         3,  'Plancher : si moins de candidats scorés, on garde tout (pas de cap)'),
  ('lookback_days_kpi',          90, 'Fenêtre (jours) pour calculer taux de réponse et latence vendeur')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE VIEW public.vendor_rfq_kpis_v
WITH (security_invoker = true) AS
WITH recent AS (
  SELECT
    dl.vendor_id,
    dl.dispatched_at,
    dl.responded_at,
    dl.declined_at,
    EXTRACT(EPOCH FROM (dl.responded_at - dl.dispatched_at)) / 60.0 AS response_minutes
  FROM public.rfq_dispatch_log dl
  WHERE dl.dispatched_at >= now() - interval '180 days'
)
SELECT
  v.id AS vendor_id,
  COUNT(r.*)::int                                                  AS dispatched_count,
  COUNT(r.responded_at)::int                                       AS responded_count,
  COUNT(r.declined_at)::int                                        AS declined_count,
  CASE WHEN COUNT(r.*) = 0 THEN NULL
       ELSE COUNT(r.responded_at)::numeric / COUNT(r.*)::numeric END AS response_rate,
  AVG(r.response_minutes) FILTER (WHERE r.responded_at IS NOT NULL)  AS avg_response_minutes
FROM public.vendors v
LEFT JOIN recent r ON r.vendor_id = v.id
GROUP BY v.id;

COMMENT ON VIEW public.vendor_rfq_kpis_v IS
  'KPIs vendeur sur 180j glissants : volume dispatché, taux de réponse, latence moyenne (minutes).';

DROP FUNCTION IF EXISTS public.rfq_score_target_vendors(uuid);
CREATE OR REPLACE FUNCTION public.rfq_score_target_vendors(_rfq_id uuid)
RETURNS TABLE(
  vendor_id          uuid,
  reason             public.rfq_target_reason,
  score              numeric,
  score_response     numeric,
  score_latency      numeric,
  score_price        numeric,
  score_availability numeric,
  score_reason       numeric,
  score_rating       numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rfq record;
  _ref_price numeric;
BEGIN
  SELECT id, product_id, quantity, target_price_excl_vat_cents
  INTO _rfq FROM public.rfqs WHERE id = _rfq_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF _rfq.target_price_excl_vat_cents IS NOT NULL THEN
    _ref_price := _rfq.target_price_excl_vat_cents::numeric;
  ELSIF _rfq.product_id IS NOT NULL THEN
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY o.price_cents)
    INTO _ref_price
    FROM public.offers o
    WHERE o.product_id = _rfq.product_id AND o.is_active = true AND o.price_cents IS NOT NULL;
  END IF;

  RETURN QUERY
  WITH targets AS (
    SELECT t.vendor_id, t.reason FROM public.rfq_resolve_target_vendors(_rfq_id) t
  ),
  vendor_offer AS (
    SELECT
      o.vendor_id,
      MIN(o.price_cents)::numeric AS best_price,
      bool_or(o.stock_quantity IS NULL OR o.stock_quantity >= COALESCE(_rfq.quantity, 1)) AS has_stock,
      bool_or(o.moq IS NULL OR o.moq <= COALESCE(_rfq.quantity, 1)) AS moq_ok
    FROM public.offers o
    WHERE _rfq.product_id IS NOT NULL
      AND o.product_id = _rfq.product_id
      AND o.is_active = true
    GROUP BY o.vendor_id
  ),
  scored AS (
    SELECT
      t.vendor_id,
      t.reason,
      COALESCE(k.response_rate, 0.4) AS s_resp,
      CASE
        WHEN k.avg_response_minutes IS NULL THEN 0.5
        WHEN k.avg_response_minutes <= 60 THEN 1.0
        WHEN k.avg_response_minutes >= 60 * 48 THEN 0.0
        ELSE GREATEST(0.0, 1.0 - (k.avg_response_minutes - 60) / (60.0 * 47))
      END AS s_lat,
      CASE
        WHEN _ref_price IS NULL OR vo.best_price IS NULL THEN 0.5
        WHEN vo.best_price <= _ref_price THEN 1.0
        WHEN vo.best_price >= _ref_price * 1.5 THEN 0.0
        ELSE 1.0 - ((vo.best_price - _ref_price) / (_ref_price * 0.5))
      END AS s_price,
      CASE
        WHEN vo.vendor_id IS NULL THEN 0.3
        WHEN vo.has_stock AND vo.moq_ok THEN 1.0
        WHEN vo.has_stock OR vo.moq_ok THEN 0.6
        ELSE 0.2
      END AS s_avail,
      CASE t.reason
        WHEN 'product_offer'         THEN 1.0
        WHEN 'product_interest'      THEN 0.85
        WHEN 'brand_interest'        THEN 0.7
        WHEN 'manufacturer_interest' THEN 0.6
        WHEN 'category_interest'     THEN 0.4
        ELSE 0.3
      END AS s_reason,
      COALESCE(v.rating / 5.0, 0.6) AS s_rating
    FROM targets t
    JOIN public.vendors v ON v.id = t.vendor_id
    LEFT JOIN public.vendor_rfq_kpis_v k ON k.vendor_id = t.vendor_id
    LEFT JOIN vendor_offer vo ON vo.vendor_id = t.vendor_id
  )
  SELECT
    s.vendor_id, s.reason,
    ROUND(
      (0.30 * s.s_resp) + (0.15 * s.s_lat) + (0.20 * s.s_price)
    + (0.15 * s.s_avail) + (0.15 * s.s_reason) + (0.05 * s.s_rating)
    , 4) AS score,
    ROUND(s.s_resp, 4),
    ROUND(s.s_lat, 4),
    ROUND(s.s_price, 4),
    ROUND(s.s_avail, 4),
    ROUND(s.s_reason, 4),
    ROUND(s.s_rating, 4)
  FROM scored s
  ORDER BY score DESC, s.s_reason DESC, s.vendor_id;
END;
$$;

COMMENT ON FUNCTION public.rfq_score_target_vendors(uuid) IS
  'Score [0..1] chaque vendeur éligible : 30% taux de réponse, 20% prix, 15% latence, 15% dispo/MOQ, 15% pertinence ciblage, 5% rating.';

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
DECLARE
  _cap         int;
  _default_cap int;
  _min_floor   int;
  _candidates  int;
BEGIN
  SELECT max_target_vendors INTO _cap FROM public.rfqs WHERE id = _rfq_id;

  SELECT value_int INTO _default_cap
  FROM public.rfq_routing_settings WHERE key = 'default_max_target_vendors';
  SELECT value_int INTO _min_floor
  FROM public.rfq_routing_settings WHERE key = 'min_target_vendors';

  _cap       := COALESCE(_cap, _default_cap, 8);
  _min_floor := COALESCE(_min_floor, 3);

  SELECT COUNT(*) INTO _candidates
  FROM public.rfq_score_target_vendors(_rfq_id);

  IF _candidates <= _min_floor THEN
    RETURN QUERY
    SELECT s.vendor_id, s.reason, s.score,
           ROW_NUMBER() OVER (ORDER BY s.score DESC, s.vendor_id)::int
    FROM public.rfq_score_target_vendors(_rfq_id) s;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.vendor_id, s.reason, s.score,
         ROW_NUMBER() OVER (ORDER BY s.score DESC, s.vendor_id)::int AS rn
  FROM public.rfq_score_target_vendors(_rfq_id) s
  ORDER BY s.score DESC, s.vendor_id
  LIMIT _cap;
END;
$$;

COMMENT ON FUNCTION public.rfq_select_top_vendors(uuid) IS
  'Top N (cap RFQ ou défaut système) des vendeurs scorés. Fallback : si #candidats <= plancher, retourne tout.';

GRANT EXECUTE ON FUNCTION public.rfq_score_target_vendors(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rfq_select_top_vendors(uuid)   TO authenticated, service_role;
