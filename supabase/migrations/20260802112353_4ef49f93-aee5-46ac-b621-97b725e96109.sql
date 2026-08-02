-- ── 1. Snapshot offre sur order_items (offer_id existe déjà) ──────────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS applied_margin_pct_snapshot NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS vendor_id_snapshot UUID,
  ADD COLUMN IF NOT EXISTS is_qogita_backed_snapshot BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_order_items_offer ON public.order_items(offer_id);

-- ── 2. Colonne calculée cagnotte_eligible sur offers ──────────────────────
SET LOCAL lock_timeout = '60s';
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS cagnotte_eligible BOOLEAN GENERATED ALWAYS AS (
    applied_margin_percentage IS NOT NULL
    AND applied_margin_percentage >= 0.14
    AND is_active = true
    AND admin_hidden = false
  ) STORED;

GRANT SELECT (cagnotte_eligible) ON public.offers TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_offers_cagnotte_eligible
  ON public.offers(cagnotte_eligible, product_id)
  WHERE cagnotte_eligible = true;

-- ── 3. Vue product-level pour le badge catalogue ──────────────────────────
CREATE OR REPLACE VIEW public.product_cagnotte_status
WITH (security_invoker = true) AS
SELECT
  p.id AS product_id,
  EXISTS (SELECT 1 FROM public.offers o WHERE o.product_id = p.id AND o.cagnotte_eligible) AS has_eligible_offer,
  (SELECT COUNT(*) FROM public.offers o WHERE o.product_id = p.id AND o.cagnotte_eligible) AS nb_eligible_offers,
  (SELECT COUNT(*) FROM public.offers o WHERE o.product_id = p.id AND o.is_active AND o.admin_hidden = false) AS nb_total_offers
FROM public.products p
WHERE p.is_active = true AND p.is_published = true;

GRANT SELECT ON public.product_cagnotte_status TO anon, authenticated;

-- ── 4. Paramètres ─────────────────────────────────────────────────────────
INSERT INTO public.settings (key, value) VALUES
  ('cagnotte_min_commission_eligibility', '0.14'::jsonb),
  ('cagnotte_min_applied_margin_pct', '0.14'::jsonb),
  ('cagnotte_financing_mode', '"medikong_full"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── 5. Backfill des order_items existants ─────────────────────────────────
-- 5a. lignes déjà rattachées à une offre : simple snapshot
UPDATE public.order_items oi
SET vendor_id_snapshot = o.vendor_id,
    applied_margin_pct_snapshot = o.applied_margin_percentage,
    is_qogita_backed_snapshot = o.is_qogita_backed,
    cagnotte_eligible_snapshot = COALESCE(o.cagnotte_eligible, false)
FROM public.offers o
WHERE oi.offer_id = o.id
  AND oi.applied_margin_pct_snapshot IS NULL;

-- 5b. lignes historiques sans offer_id : heuristique meilleure offre active
--     (approximation assumée, pas l'offre réellement vendue à l'époque)
UPDATE public.order_items oi
SET offer_id = m.offer_id,
    vendor_id_snapshot = m.vendor_id,
    applied_margin_pct_snapshot = m.applied_margin_percentage,
    is_qogita_backed_snapshot = m.is_qogita_backed,
    cagnotte_eligible_snapshot = COALESCE(m.cagnotte_eligible, false)
FROM (
  SELECT DISTINCT ON (oi_inner.id)
    oi_inner.id AS order_item_id,
    o.id AS offer_id, o.vendor_id, o.applied_margin_percentage,
    o.is_qogita_backed, o.cagnotte_eligible
  FROM public.order_items oi_inner
  JOIN public.offers o ON o.product_id = oi_inner.product_id
  WHERE oi_inner.offer_id IS NULL AND o.is_active = true
  ORDER BY oi_inner.id, o.applied_margin_percentage DESC NULLS LAST
) m
WHERE oi.id = m.order_item_id AND oi.offer_id IS NULL;

-- ── 6. snapshot_order_commission : source de vérité = l'offre vendue ──────
CREATE OR REPLACE FUNCTION public.snapshot_order_commission(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_commission numeric(10,2);
  v_eligible_ht numeric(10,2);
  v_min_margin numeric := 0.14;
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  SELECT COALESCE((value #>> '{}')::numeric, 0.14) INTO v_min_margin
  FROM public.settings WHERE key = 'cagnotte_min_applied_margin_pct';

  -- Gèle le snapshot offre (marge appliquée, vendeur, provenance) puis
  -- l'éligibilité cagnotte et la commission. Markup sur coût -> marge sur
  -- prix de vente : rate / (1 + rate).
  UPDATE public.order_items oi
  SET vendor_id_snapshot = COALESCE(oi.vendor_id_snapshot, o.vendor_id),
      is_qogita_backed_snapshot = COALESCE(oi.is_qogita_backed_snapshot, o.is_qogita_backed),
      applied_margin_pct_snapshot = COALESCE(oi.applied_margin_pct_snapshot, o.applied_margin_percentage),
      cagnotte_eligible_snapshot = COALESCE(
        oi.cagnotte_eligible_snapshot,
        CASE
          WHEN COALESCE(oi.applied_margin_pct_snapshot, o.applied_margin_percentage) IS NOT NULL
            THEN COALESCE(oi.applied_margin_pct_snapshot, o.applied_margin_percentage) >= v_min_margin
          ELSE p.cagnotte_eligible
        END
      ),
      commission_rate_snapshot = COALESCE(
        oi.commission_rate_snapshot,
        CASE
          WHEN COALESCE(oi.applied_margin_pct_snapshot, o.applied_margin_percentage) IS NOT NULL THEN
            ROUND(
              COALESCE(oi.applied_margin_pct_snapshot, o.applied_margin_percentage)
              / (1 + COALESCE(oi.applied_margin_pct_snapshot, o.applied_margin_percentage))
            , 4)
          ELSE p.commission_rate
        END
      )
  FROM public.products p
  LEFT JOIN public.offers o ON o.id = oi.offer_id
  WHERE oi.product_id = p.id AND oi.order_id = p_order_id;

  UPDATE public.order_items oi
  SET commission_ht = ROUND(COALESCE(oi.line_total_excl_vat, 0) * COALESCE(oi.commission_rate_snapshot, 0), 2)
  WHERE oi.order_id = p_order_id;

  SELECT COALESCE(SUM(commission_ht), 0),
         COALESCE(SUM(line_total_excl_vat) FILTER (WHERE cagnotte_eligible_snapshot), 0)
  INTO v_total_commission, v_eligible_ht
  FROM public.order_items WHERE order_id = p_order_id;

  UPDATE public.orders
  SET commission_total_ht = v_total_commission,
      cagnotte_eligible_ht = v_eligible_ht
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'commission_total_ht', v_total_commission,
    'cagnotte_eligible_ht', v_eligible_ht
  );
END;
$function$;