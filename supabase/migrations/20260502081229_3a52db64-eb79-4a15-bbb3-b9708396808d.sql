CREATE OR REPLACE FUNCTION public.detect_market_delta_anomalies(
  _threshold_pct numeric DEFAULT NULL,
  _triggered_by text DEFAULT 'manual'
)
RETURNS TABLE(run_id uuid, anomalies_found integer, offers_scanned integer, offers_with_market integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_run_id uuid := gen_random_uuid();
  v_scanned integer := 0;
  v_with_market integer := 0;
  v_found integer := 0;
  v_default_threshold numeric;
BEGIN
  v_default_threshold := COALESCE(
    _threshold_pct,
    (SELECT t.threshold_pct FROM public.market_delta_thresholds t WHERE t.scope='global' AND t.is_active LIMIT 1),
    0.15
  );

  IF v_default_threshold <= 0 THEN
    RAISE EXCEPTION 'threshold_pct must be > 0';
  END IF;

  INSERT INTO public.market_delta_runs(id, threshold_pct, triggered_by)
  VALUES (v_run_id, v_default_threshold, COALESCE(_triggered_by,'manual'));

  WITH ext AS (
    SELECT
      eo.product_id,
      eo.unit_price::numeric / GREATEST(COALESCE(NULLIF(eo.pack_size_override,0), p.pack_size, 1), 1) AS ext_unit_price
    FROM public.external_offers eo
    JOIN public.products p ON p.id = eo.product_id
    WHERE eo.is_active = true
      AND eo.unit_price IS NOT NULL
      AND eo.unit_price > 0
  ),
  ext_agg AS (
    SELECT product_id,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY ext_unit_price)::numeric(12,4) AS market_median,
           COUNT(*)::int AS sample_size
    FROM ext
    GROUP BY product_id
  ),
  mk AS (
    SELECT
      o.id AS offer_id,
      o.product_id,
      o.vendor_id,
      GREATEST(COALESCE(p.pack_size, 1), 1) AS mk_pack,
      (o.price_excl_vat::numeric / GREATEST(COALESCE(p.pack_size,1),1))::numeric(12,4) AS mk_unit_price
    FROM public.offers o
    JOIN public.products p ON p.id = o.product_id
    WHERE o.is_active = true
      AND o.price_excl_vat IS NOT NULL
      AND o.price_excl_vat > 0
  ),
  scan AS (
    SELECT
      mk.offer_id, mk.product_id, mk.vendor_id, mk.mk_pack, mk.mk_unit_price,
      ext_agg.market_median, ext_agg.sample_size,
      (mk.mk_unit_price - ext_agg.market_median) AS delta_abs,
      ((mk.mk_unit_price - ext_agg.market_median) / NULLIF(ext_agg.market_median,0)) AS delta_pct,
      COALESCE(_threshold_pct, public.resolve_market_delta_threshold(mk.product_id)) AS effective_threshold
    FROM mk
    LEFT JOIN ext_agg ON ext_agg.product_id = mk.product_id
  ),
  ins AS (
    INSERT INTO public.market_delta_anomalies(
      run_id, offer_id, product_id, vendor_id,
      mk_pack_size, mk_unit_price,
      market_unit_price_median, market_sample_size,
      delta_abs, delta_pct, direction, threshold_pct
    )
    SELECT
      v_run_id, s.offer_id, s.product_id, s.vendor_id,
      s.mk_pack, s.mk_unit_price,
      s.market_median, s.sample_size,
      s.delta_abs, s.delta_pct,
      CASE WHEN s.delta_pct >= 0 THEN 'mk_higher' ELSE 'mk_lower' END,
      s.effective_threshold
    FROM scan s
    WHERE s.market_median IS NOT NULL
      AND ABS(s.delta_pct) >= s.effective_threshold
    ON CONFLICT (run_id, offer_id) DO NOTHING
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*) FROM mk),
    (SELECT COUNT(*) FROM scan s2 WHERE s2.market_median IS NOT NULL),
    (SELECT COUNT(*) FROM ins)
  INTO v_scanned, v_with_market, v_found;

  UPDATE public.market_delta_runs r
  SET finished_at = now(),
      offers_scanned = v_scanned,
      offers_with_market = v_with_market,
      anomalies_found = v_found
  WHERE r.id = v_run_id;

  RETURN QUERY SELECT v_run_id, v_found, v_scanned, v_with_market;
END;
$$;