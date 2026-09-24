-- Import mensuel des prix grossistes (admin). Met à jour market_prices (prix courant)
-- ET ajoute/remplace une ligne par produit dans market_price_history pour le mois.
CREATE OR REPLACE FUNCTION public.admin_import_wholesaler_prices(_source_id uuid, _period date, _rows jsonb, _source_file text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb; v_cnk text; v_ean text; v_price numeric; v_pid uuid; v_mp uuid; v_prev numeric;
  n_rows int := 0; n_matched int := 0; unmatched jsonb := '[]'::jsonb; deltas jsonb := '[]'::jsonb;
  v_period date := date_trunc('month', _period)::date;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM market_price_sources WHERE id = _source_id) THEN RAISE EXCEPTION 'unknown source'; END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    v_cnk := public.normalize_cnk(r->>'cnk');
    v_ean := NULLIF(regexp_replace(coalesce(r->>'ean',''), '\D', '', 'g'), '');
    v_price := NULLIF(replace(coalesce(r->>'price',''), ',', '.'), '')::numeric;
    CONTINUE WHEN v_price IS NULL OR (v_cnk IS NULL AND v_ean IS NULL);
    n_rows := n_rows + 1;

    v_pid := NULL;
    IF v_cnk IS NOT NULL THEN
      SELECT id INTO v_pid FROM products WHERE public.normalize_cnk(cnk_code) = v_cnk ORDER BY is_active DESC NULLS LAST LIMIT 1;
    END IF;
    IF v_pid IS NULL AND v_ean IS NOT NULL THEN
      SELECT id INTO v_pid FROM products WHERE gtin = v_ean ORDER BY is_active DESC NULLS LAST LIMIT 1;
    END IF;

    -- Prix courant
    v_mp := NULL;
    IF v_cnk IS NOT NULL THEN
      SELECT id INTO v_mp FROM market_prices WHERE source_id = _source_id AND public.normalize_cnk(cnk) = v_cnk LIMIT 1;
    END IF;
    IF v_mp IS NULL AND v_ean IS NOT NULL THEN
      SELECT id INTO v_mp FROM market_prices WHERE source_id = _source_id AND ean = v_ean LIMIT 1;
    END IF;
    IF v_mp IS NOT NULL THEN
      UPDATE market_prices SET prix_pharmacien = v_price, product_id = coalesce(v_pid, product_id),
        is_matched = (coalesce(v_pid, product_id) IS NOT NULL), imported_at = now() WHERE id = v_mp;
    ELSE
      INSERT INTO market_prices (source_id, product_id, cnk, ean, product_name_source, prix_pharmacien, is_matched, imported_at)
      VALUES (_source_id, v_pid, v_cnk, v_ean, r->>'name', v_price, v_pid IS NOT NULL, now());
    END IF;

    IF v_pid IS NULL THEN
      IF jsonb_array_length(unmatched) < 2000 THEN
        unmatched := unmatched || jsonb_build_object('cnk', v_cnk, 'ean', v_ean, 'name', r->>'name', 'price', v_price);
      END IF;
      CONTINUE;
    END IF;
    n_matched := n_matched + 1;

    SELECT price_excl_vat INTO v_prev FROM market_price_history
      WHERE source_id = _source_id AND product_id = v_pid AND period = (v_period - interval '1 month')::date;
    IF v_prev IS NOT NULL AND v_prev > 0 AND abs(v_price - v_prev) / v_prev > 0.15 THEN
      deltas := deltas || jsonb_build_object('product_id', v_pid, 'cnk', v_cnk, 'prev', v_prev, 'new', v_price,
        'pct', round((v_price - v_prev) / v_prev * 100, 1));
    END IF;

    INSERT INTO market_price_history (source_id, product_id, period, price_excl_vat, imported_at)
    VALUES (_source_id, v_pid, v_period, v_price, now())
    ON CONFLICT (source_id, product_id, period) DO UPDATE SET price_excl_vat = EXCLUDED.price_excl_vat, imported_at = now();
  END LOOP;

  INSERT INTO audit_logs (action, entity_type, details)
  SELECT 'wholesaler_prices_import', 'market_price_sources',
    jsonb_build_object('source_id', _source_id, 'period', v_period, 'file', _source_file, 'rows', n_rows, 'matched', n_matched)
  WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='details');

  RETURN jsonb_build_object('rows', n_rows, 'matched', n_matched, 'unmatched', unmatched, 'deltas', deltas);
END $$;
REVOKE ALL ON FUNCTION public.admin_import_wholesaler_prices(uuid, date, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_import_wholesaler_prices(uuid, date, jsonb, text) TO authenticated, service_role;