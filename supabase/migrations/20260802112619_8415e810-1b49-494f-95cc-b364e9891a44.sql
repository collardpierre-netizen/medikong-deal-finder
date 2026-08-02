SET LOCAL lock_timeout = '60s';

DROP INDEX IF EXISTS public.idx_offers_cagnotte_eligible;
DROP VIEW IF EXISTS public.product_cagnotte_status;
ALTER TABLE public.offers DROP COLUMN IF EXISTS cagnotte_eligible;

-- applied_margin_percentage est en POINTS de pourcentage (12.00 .. 25.00)
ALTER TABLE public.offers
  ADD COLUMN cagnotte_eligible BOOLEAN GENERATED ALWAYS AS (
    applied_margin_percentage IS NOT NULL
    AND applied_margin_percentage >= 14
    AND is_active = true
    AND admin_hidden = false
  ) STORED;

GRANT SELECT (cagnotte_eligible) ON public.offers TO anon, authenticated;

CREATE VIEW public.product_cagnotte_status
WITH (security_invoker = true) AS
SELECT
  p.id AS product_id,
  EXISTS (SELECT 1 FROM public.offers o WHERE o.product_id = p.id AND o.cagnotte_eligible) AS has_eligible_offer,
  (SELECT COUNT(*) FROM public.offers o WHERE o.product_id = p.id AND o.cagnotte_eligible) AS nb_eligible_offers,
  (SELECT COUNT(*) FROM public.offers o WHERE o.product_id = p.id AND o.is_active AND o.admin_hidden = false) AS nb_total_offers
FROM public.products p
WHERE p.is_active = true AND p.is_published = true;

GRANT SELECT ON public.product_cagnotte_status TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_offers_cagnotte_eligible
  ON public.offers(cagnotte_eligible, product_id)
  WHERE cagnotte_eligible = true;

UPDATE public.settings SET value = '14'::jsonb
WHERE key IN ('cagnotte_min_applied_margin_pct', 'cagnotte_min_commission_eligibility');

-- Re-snapshot des lignes déjà backfillées avec le mauvais seuil
UPDATE public.order_items oi
SET cagnotte_eligible_snapshot = COALESCE(o.cagnotte_eligible, false),
    commission_rate_snapshot = CASE
      WHEN o.applied_margin_percentage IS NOT NULL
        THEN ROUND((o.applied_margin_percentage / 100) / (1 + o.applied_margin_percentage / 100), 4)
      ELSE oi.commission_rate_snapshot
    END
FROM public.offers o
WHERE oi.offer_id = o.id
  AND oi.applied_margin_pct_snapshot IS NOT NULL;

CREATE OR REPLACE FUNCTION public.snapshot_order_commission(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_commission numeric(10,2);
  v_eligible_ht numeric(10,2);
  v_min_margin numeric := 14;
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  SELECT COALESCE((value #>> '{}')::numeric, 14) INTO v_min_margin
  FROM public.settings WHERE key = 'cagnotte_min_applied_margin_pct';

  -- Snapshot offre (marge appliquée en POINTS de %, vendeur, provenance),
  -- éligibilité cagnotte, puis commission :
  -- markup sur coût -> marge sur prix de vente = m / (1 + m), m = pct / 100.
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
              (COALESCE(oi.applied_margin_pct_snapshot, o.applied_margin_percentage) / 100)
              / (1 + COALESCE(oi.applied_margin_pct_snapshot, o.applied_margin_percentage) / 100)
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