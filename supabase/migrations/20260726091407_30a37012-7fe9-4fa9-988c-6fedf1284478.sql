
CREATE OR REPLACE FUNCTION public.recalc_qogita_offers_batch(
  _last_id uuid DEFAULT NULL,
  _limit int DEFAULT 2000
)
RETURNS TABLE(updated int, last_id uuid, remaining bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_margin numeric := 25.0;
  v_updated int := 0;
  v_last uuid := NULL;
  v_remaining bigint := 0;
BEGIN
  SELECT COALESCE((SELECT (value)::numeric FROM public.qogita_config WHERE key='margin_percentage'), 25.0)
    INTO v_margin;

  WITH batch AS (
    SELECT o.id,
           o.qogita_base_price::numeric AS base,
           COALESCE(o.qogita_base_delay_days, 3) AS base_delay,
           COALESCE(o.vat_rate, 0)::numeric AS vat
    FROM public.offers o
    WHERE o.is_qogita_backed = true
      AND o.is_active = true
      AND (o.price_stale IS NOT TRUE)
      AND o.qogita_base_price IS NOT NULL
      AND o.qogita_base_price > 0
      AND (_last_id IS NULL OR o.id > _last_id)
    ORDER BY o.id
    LIMIT _limit
  ),
  upd AS (
    UPDATE public.offers o
    SET price_excl_vat = round( (b.base * (1 + v_margin/100))::numeric, 2),
        price_incl_vat = round( (b.base * (1 + v_margin/100) * (1 + b.vat/100))::numeric, 2),
        margin_amount = round( (b.base * (v_margin/100))::numeric, 2),
        applied_margin_percentage = v_margin,
        applied_margin_rule_id = NULL,
        delivery_days = b.base_delay + 2,
        price_source = 'qogita_margin_recalc',
        price_source_updated_at = now()
    FROM batch b
    WHERE o.id = b.id
    RETURNING o.id
  )
  SELECT count(*)::int,
         (SELECT u.id FROM upd u ORDER BY u.id DESC LIMIT 1)
    INTO v_updated, v_last
  FROM upd;

  IF v_updated = 0 THEN
    v_last := NULL;
  END IF;

  SELECT count(*) INTO v_remaining
  FROM public.offers
  WHERE is_qogita_backed = true
    AND is_active = true
    AND price_stale IS NOT TRUE
    AND qogita_base_price > 0
    AND price_source IS DISTINCT FROM 'qogita_margin_recalc';

  RETURN QUERY SELECT v_updated, v_last, v_remaining;
END;
$fn$;
