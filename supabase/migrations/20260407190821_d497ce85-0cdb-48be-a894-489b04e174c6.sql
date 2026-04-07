
-- Function to detect price alerts in bulk via SQL (much faster than edge function row-by-row)
CREATE OR REPLACE FUNCTION public.detect_price_alerts_batch(
  _th_info numeric DEFAULT 5,
  _th_warn numeric DEFAULT 15,
  _th_crit numeric DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_created int := 0;
  v_updated int := 0;
  v_resolved int := 0;
  v_ref_set int := 0;
  r RECORD;
BEGIN
  -- Step 1: Build temp table of best competitor price per product
  CREATE TEMP TABLE IF NOT EXISTS tmp_competitor_best (
    product_id uuid PRIMARY KEY,
    best_price numeric,
    source text
  ) ON COMMIT DROP;

  TRUNCATE tmp_competitor_best;

  -- From market_prices
  INSERT INTO tmp_competitor_best (product_id, best_price, source)
  SELECT mp.product_id,
    MIN(LEAST(
      COALESCE(mp.prix_pharmacien, 999999),
      COALESCE(mp.prix_grossiste, 999999),
      COALESCE(mp.prix_public, 999999)
    )),
    'market_price'
  FROM market_prices mp
  WHERE mp.is_matched = true AND mp.product_id IS NOT NULL
  GROUP BY mp.product_id
  HAVING MIN(LEAST(
    COALESCE(mp.prix_pharmacien, 999999),
    COALESCE(mp.prix_grossiste, 999999),
    COALESCE(mp.prix_public, 999999)
  )) < 999999;

  -- Merge external_offers (keep lowest)
  INSERT INTO tmp_competitor_best (product_id, best_price, source)
  SELECT eo.product_id, MIN(eo.unit_price), 'external_offer'
  FROM external_offers eo
  WHERE eo.is_active = true AND eo.unit_price > 0
  GROUP BY eo.product_id
  ON CONFLICT (product_id) DO UPDATE
  SET best_price = LEAST(tmp_competitor_best.best_price, EXCLUDED.best_price),
      source = CASE WHEN EXCLUDED.best_price < tmp_competitor_best.best_price THEN EXCLUDED.source ELSE tmp_competitor_best.source END;

  -- Step 2: Update reference_price on products
  UPDATE products p
  SET reference_price = c.best_price
  FROM tmp_competitor_best c
  WHERE p.id = c.product_id;

  GET DIAGNOSTICS v_ref_set = ROW_COUNT;

  -- Step 3: Create/update alerts for products where MediKong > competitor
  FOR r IN
    SELECT p.id as product_id, p.best_price_incl_vat as mk_price,
      c.best_price as ref_price, c.source,
      ROUND((p.best_price_incl_vat - c.best_price) / c.best_price * 100, 1) as gap_pct,
      ROUND(p.best_price_incl_vat - c.best_price, 2) as gap_amt
    FROM products p
    JOIN tmp_competitor_best c ON c.product_id = p.id
    WHERE p.is_active = true
      AND p.best_price_incl_vat > 0
      AND p.best_price_incl_vat > c.best_price
      AND ROUND((p.best_price_incl_vat - c.best_price) / c.best_price * 100, 1) >= _th_info
  LOOP
    DECLARE
      v_severity text;
      v_alert_type alert_type;
      v_existing_id uuid;
    BEGIN
      -- Determine severity
      IF r.gap_pct >= _th_crit THEN v_severity := 'critical';
      ELSIF r.gap_pct >= _th_warn THEN v_severity := 'warning';
      ELSE v_severity := 'info';
      END IF;

      v_alert_type := r.source::alert_type;

      -- Check existing
      SELECT id INTO v_existing_id FROM price_alerts
      WHERE product_id = r.product_id AND status IN ('open', 'acknowledged')
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        UPDATE price_alerts SET
          reference_price = r.ref_price, best_medikong_price = r.mk_price,
          gap_amount = r.gap_amt, gap_percentage = r.gap_pct,
          severity = v_severity, alert_type = v_alert_type, updated_at = now()
        WHERE id = v_existing_id;
        v_updated := v_updated + 1;
      ELSE
        INSERT INTO price_alerts (product_id, alert_type, severity, reference_price, best_medikong_price, gap_amount, gap_percentage, status)
        VALUES (r.product_id, v_alert_type, v_severity, r.ref_price, r.mk_price, r.gap_amt, r.gap_pct, 'open');
        v_created := v_created + 1;
      END IF;
    END;
  END LOOP;

  -- Step 4: Auto-resolve alerts where MediKong is now cheaper or equal
  UPDATE price_alerts pa
  SET status = 'resolved', resolved_at = now()
  FROM products p
  JOIN tmp_competitor_best c ON c.product_id = p.id
  WHERE pa.product_id = p.id
    AND pa.status IN ('open', 'acknowledged')
    AND p.best_price_incl_vat <= c.best_price;

  GET DIAGNOSTICS v_resolved = ROW_COUNT;

  RETURN jsonb_build_object(
    'reference_prices_set', v_ref_set,
    'alerts_created', v_created,
    'alerts_updated', v_updated,
    'alerts_resolved', v_resolved
  );
END;
$$;
