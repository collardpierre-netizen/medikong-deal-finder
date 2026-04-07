
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
  v_severity text;
  v_alert_type alert_type;
  v_existing_id uuid;
BEGIN
  -- Step 1: Update reference_price from best competitor price
  UPDATE products p
  SET reference_price = sub.best_price
  FROM (
    SELECT mp.product_id,
      MIN(LEAST(
        COALESCE(mp.prix_pharmacien, 999999),
        COALESCE(mp.prix_grossiste, 999999),
        COALESCE(mp.prix_public, 999999)
      )) as best_price
    FROM market_prices mp
    WHERE mp.is_matched = true AND mp.product_id IS NOT NULL
    GROUP BY mp.product_id
    HAVING MIN(LEAST(COALESCE(mp.prix_pharmacien,999999), COALESCE(mp.prix_grossiste,999999), COALESCE(mp.prix_public,999999))) < 999999
  ) sub
  WHERE p.id = sub.product_id;

  GET DIAGNOSTICS v_ref_set = ROW_COUNT;

  -- Step 2: Create/update alerts where MediKong price > competitor
  FOR r IN
    WITH competitor AS (
      SELECT mp.product_id,
        MIN(LEAST(COALESCE(mp.prix_pharmacien,999999), COALESCE(mp.prix_grossiste,999999), COALESCE(mp.prix_public,999999))) as best_price
      FROM market_prices mp
      WHERE mp.is_matched = true AND mp.product_id IS NOT NULL
      GROUP BY mp.product_id
      HAVING MIN(LEAST(COALESCE(mp.prix_pharmacien,999999), COALESCE(mp.prix_grossiste,999999), COALESCE(mp.prix_public,999999))) < 999999
    )
    SELECT p.id as product_id, p.best_price_incl_vat as mk_price,
      c.best_price as ref_price,
      ROUND((p.best_price_incl_vat - c.best_price) / c.best_price * 100, 1) as gap_pct,
      ROUND(p.best_price_incl_vat - c.best_price, 2) as gap_amt
    FROM products p
    JOIN competitor c ON c.product_id = p.id
    WHERE p.is_active = true
      AND p.best_price_incl_vat > 0
      AND p.best_price_incl_vat > c.best_price
      AND ROUND((p.best_price_incl_vat - c.best_price) / c.best_price * 100, 1) >= _th_info
  LOOP
    IF r.gap_pct >= _th_crit THEN v_severity := 'critical';
    ELSIF r.gap_pct >= _th_warn THEN v_severity := 'warning';
    ELSE v_severity := 'info';
    END IF;

    v_alert_type := 'market_price'::alert_type;

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
  END LOOP;

  -- Step 3: Auto-resolve where MediKong <= competitor
  WITH competitor AS (
    SELECT mp.product_id,
      MIN(LEAST(COALESCE(mp.prix_pharmacien,999999), COALESCE(mp.prix_grossiste,999999), COALESCE(mp.prix_public,999999))) as best_price
    FROM market_prices mp
    WHERE mp.is_matched = true AND mp.product_id IS NOT NULL
    GROUP BY mp.product_id
    HAVING MIN(LEAST(COALESCE(mp.prix_pharmacien,999999), COALESCE(mp.prix_grossiste,999999), COALESCE(mp.prix_public,999999))) < 999999
  )
  UPDATE price_alerts pa
  SET status = 'resolved', resolved_at = now()
  FROM products p
  JOIN competitor c ON c.product_id = p.id
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
