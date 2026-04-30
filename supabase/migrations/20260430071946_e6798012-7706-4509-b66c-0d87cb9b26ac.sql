
-- 1. Nouvelles colonnes de scoring
ALTER TABLE public.rfq_responses
  ADD COLUMN IF NOT EXISTS score numeric(5,2),
  ADD COLUMN IF NOT EXISTS score_price numeric(5,2),
  ADD COLUMN IF NOT EXISTS score_delivery numeric(5,2),
  ADD COLUMN IF NOT EXISTS score_compliance numeric(5,2),
  ADD COLUMN IF NOT EXISTS score_availability numeric(5,2),
  ADD COLUMN IF NOT EXISTS is_top_pick boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scored_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_rfq_responses_rfq_score
  ON public.rfq_responses (rfq_id, score DESC NULLS LAST);

-- 2. Fonction de recalcul des scores pour une RFQ donnée
CREATE OR REPLACE FUNCTION public.rfq_recompute_response_scores(_rfq_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rfq record;
  v_min_price int;
  v_max_price int;
  v_min_delivery int;
  v_max_delivery int;
  v_dispatch timestamptz;
BEGIN
  SELECT id, quantity, required_offer_validity_days, dispatched_at, created_at, target_price_excl_vat_cents
    INTO v_rfq
    FROM public.rfqs
   WHERE id = _rfq_id;

  IF v_rfq.id IS NULL THEN
    RETURN;
  END IF;

  v_dispatch := COALESCE(v_rfq.dispatched_at, v_rfq.created_at);

  -- Bornes pour normalisation (sur réponses visibles)
  SELECT MIN(unit_price_excl_vat_cents), MAX(unit_price_excl_vat_cents),
         MIN(NULLIF(delivery_days, 0)),  MAX(NULLIF(delivery_days, 0))
    INTO v_min_price, v_max_price, v_min_delivery, v_max_delivery
    FROM public.rfq_responses
   WHERE rfq_id = _rfq_id
     AND is_visible_to_buyer = true;

  IF v_min_price IS NULL THEN
    RETURN; -- pas de réponses visibles
  END IF;

  -- Calcul + UPDATE
  WITH scored AS (
    SELECT
      r.id,
      -- Score prix (0..50). 100% si = min, 0% si = max ; si tous égaux → 100%.
      CASE
        WHEN v_max_price = v_min_price THEN 50.0
        ELSE 50.0 * (1.0 - ((r.unit_price_excl_vat_cents - v_min_price)::numeric
                            / NULLIF(v_max_price - v_min_price, 0)))
      END AS s_price,

      -- Score délai (0..25).
      CASE
        WHEN r.delivery_days IS NULL OR r.delivery_days <= 0 THEN 12.5
        WHEN v_max_delivery = v_min_delivery THEN 25.0
        ELSE 25.0 * (1.0 - ((r.delivery_days - v_min_delivery)::numeric
                            / NULLIF(v_max_delivery - v_min_delivery, 0)))
      END AS s_delivery,

      -- Score conformité (0..15) : MOQ compatible + validité offre >= demande
      (
        CASE WHEN r.moq IS NULL OR r.moq <= v_rfq.quantity THEN 10.0 ELSE 0.0 END
        +
        CASE
          WHEN v_rfq.required_offer_validity_days IS NULL THEN 5.0
          WHEN r.offer_validity_days IS NULL THEN 2.0
          WHEN r.offer_validity_days >= v_rfq.required_offer_validity_days THEN 5.0
          ELSE 0.0
        END
      ) AS s_compliance,

      -- Score disponibilité / fraîcheur (0..10) : <24h=10, <72h=7, <7j=4, sinon 1
      CASE
        WHEN v_dispatch IS NULL THEN 7.0
        WHEN EXTRACT(EPOCH FROM (r.created_at - v_dispatch)) / 3600 <= 24 THEN 10.0
        WHEN EXTRACT(EPOCH FROM (r.created_at - v_dispatch)) / 3600 <= 72 THEN 7.0
        WHEN EXTRACT(EPOCH FROM (r.created_at - v_dispatch)) / 86400 <= 7 THEN 4.0
        ELSE 1.0
      END AS s_avail,

      -- Bonus admin curation
      CASE WHEN r.admin_override_visible THEN 5.0 ELSE 0.0 END AS s_bonus,

      -- Flags conformité (JSONB)
      jsonb_build_object(
        'moq_ok',
          (r.moq IS NULL OR r.moq <= v_rfq.quantity),
        'validity_ok',
          (v_rfq.required_offer_validity_days IS NULL
           OR (r.offer_validity_days IS NOT NULL
               AND r.offer_validity_days >= v_rfq.required_offer_validity_days)),
        'beats_target_price',
          (v_rfq.target_price_excl_vat_cents IS NULL
           OR r.unit_price_excl_vat_cents <= v_rfq.target_price_excl_vat_cents),
        'admin_curated',
          COALESCE(r.admin_override_visible, false)
      ) AS flags
    FROM public.rfq_responses r
    WHERE r.rfq_id = _rfq_id
      AND r.is_visible_to_buyer = true
  ),
  finalized AS (
    SELECT
      id,
      ROUND(s_price, 2)       AS s_price,
      ROUND(s_delivery, 2)    AS s_delivery,
      ROUND(s_compliance, 2)  AS s_compliance,
      ROUND(s_avail, 2)       AS s_avail,
      LEAST(100.0, ROUND(s_price + s_delivery + s_compliance + s_avail + s_bonus, 2)) AS total,
      flags,
      ROW_NUMBER() OVER (ORDER BY (s_price + s_delivery + s_compliance + s_avail + s_bonus) DESC,
                                  id ASC) AS rnk
    FROM scored
  )
  UPDATE public.rfq_responses r
     SET score              = f.total,
         score_price        = f.s_price,
         score_delivery     = f.s_delivery,
         score_compliance   = f.s_compliance,
         score_availability = f.s_avail,
         compliance_flags   = f.flags,
         rank_position      = f.rnk,
         is_top_pick        = (f.rnk = 1),
         scored_at          = now()
    FROM finalized f
   WHERE r.id = f.id;

  -- Réponses non visibles : reset
  UPDATE public.rfq_responses
     SET is_top_pick = false
   WHERE rfq_id = _rfq_id
     AND is_visible_to_buyer = false;
END;
$$;

REVOKE ALL ON FUNCTION public.rfq_recompute_response_scores(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rfq_recompute_response_scores(uuid) TO authenticated, service_role;

-- 3. Trigger : recalcul auto à chaque INSERT/UPDATE/DELETE de réponse
CREATE OR REPLACE FUNCTION public.trg_rfq_responses_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rfq uuid;
BEGIN
  v_rfq := COALESCE(NEW.rfq_id, OLD.rfq_id);
  PERFORM public.rfq_recompute_response_scores(v_rfq);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS rfq_responses_score_trigger ON public.rfq_responses;
CREATE TRIGGER rfq_responses_score_trigger
AFTER INSERT OR UPDATE OF unit_price_excl_vat_cents, moq, delivery_days,
                          offer_validity_days, is_visible_to_buyer,
                          admin_override_visible
                OR DELETE
ON public.rfq_responses
FOR EACH ROW EXECUTE FUNCTION public.trg_rfq_responses_score();

-- 4. Backfill initial pour les RFQ existantes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT rfq_id FROM public.rfq_responses LOOP
    PERFORM public.rfq_recompute_response_scores(r.rfq_id);
  END LOOP;
END $$;
