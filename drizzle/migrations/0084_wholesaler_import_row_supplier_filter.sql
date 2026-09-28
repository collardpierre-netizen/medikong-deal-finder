DROP FUNCTION IF EXISTS public.admin_preview_wholesaler_import(uuid, jsonb);
DROP FUNCTION IF EXISTS public.admin_import_wholesaler_prices_v2(uuid, jsonb);

CREATE FUNCTION public.admin_preview_wholesaler_import(_source_id uuid, _rows jsonb, _supplier_filter boolean DEFAULT true, _include_no_supplier boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb; v_cnk text; v_ean text; v_price numeric; v_old numeric; v_found boolean;
  n int := 0; n_new int := 0; n_changed int := 0; sum_pct numeric := 0; n_pct int := 0;
  n_skip_none int := 0; n_skip_other int := 0;
  suppliers jsonb := '{}'::jsonb; bad jsonb := '{}'::jsonb; v_sup text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    v_cnk := public.normalize_cnk(r->>'cnk');
    v_ean := NULLIF(regexp_replace(coalesce(r->>'ean', ''), '\D', '', 'g'), '');
    v_price := NULLIF(replace(coalesce(r->>'price', ''), ',', '.'), '')::numeric;
    CONTINUE WHEN v_price IS NULL OR (v_cnk IS NULL AND v_ean IS NULL);
    v_sup := NULLIF(trim(coalesce(r->>'supplier', '')), '');
    IF v_sup IS NOT NULL THEN
      suppliers := jsonb_set(suppliers, ARRAY[v_sup], to_jsonb(coalesce((suppliers->>v_sup)::int, 0) + 1));
    END IF;
    IF _supplier_filter THEN
      IF v_sup IS NULL THEN
        IF NOT _include_no_supplier THEN n_skip_none := n_skip_none + 1; CONTINUE; END IF;
      ELSIF NOT public._supplier_matches_source(v_sup, _source_id) THEN
        bad := jsonb_set(bad, ARRAY[v_sup], to_jsonb(coalesce((bad->>v_sup)::int, 0) + 1));
        n_skip_other := n_skip_other + 1; CONTINUE;
      END IF;
    END IF;
    n := n + 1; v_old := NULL; v_found := false;
    IF v_cnk IS NOT NULL THEN
      SELECT prix_pharmacien, true INTO v_old, v_found FROM market_prices WHERE source_id = _source_id AND public.normalize_cnk(cnk) = v_cnk LIMIT 1;
    END IF;
    IF NOT coalesce(v_found, false) AND v_ean IS NOT NULL THEN
      SELECT prix_pharmacien, true INTO v_old, v_found FROM market_prices WHERE source_id = _source_id AND ean = v_ean LIMIT 1;
    END IF;
    IF NOT coalesce(v_found, false) THEN n_new := n_new + 1;
    ELSIF v_old IS DISTINCT FROM v_price THEN
      n_changed := n_changed + 1;
      IF v_old > 0 THEN sum_pct := sum_pct + (v_price - v_old) / v_old * 100; n_pct := n_pct + 1; END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('rows', n, 'new', n_new, 'changed', n_changed,
    'avg_delta_pct', CASE WHEN n_pct > 0 THEN round(sum_pct / n_pct, 1) END,
    'skipped_no_supplier', n_skip_none, 'skipped_other_supplier', n_skip_other,
    'suppliers', suppliers, 'mismatched_suppliers', bad);
END $function$;

CREATE FUNCTION public.admin_import_wholesaler_prices_v2(_import_id uuid, _rows jsonb, _supplier_filter boolean DEFAULT true, _include_no_supplier boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  imp market_price_imports%ROWTYPE;
  r jsonb; v_cnk text; v_ean text; v_price numeric; v_pid uuid; v_mp market_prices%ROWTYPE; v_new_id uuid;
  v_hist market_price_history%ROWTYPE; v_hist_id bigint; v_prev numeric; v_sup text;
  n_rows int := 0; n_matched int := 0; n_changed int := 0; n_ins int := 0; n_skip_none int := 0; n_skip_other int := 0;
  unmatched jsonb := '[]'::jsonb; deltas jsonb := '[]'::jsonb; v_period date; v_ts timestamptz;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO imp FROM market_price_imports WHERE id = _import_id FOR UPDATE;
  IF NOT FOUND OR imp.status <> 'running' THEN RAISE EXCEPTION 'Import introuvable ou clos'; END IF;
  v_period := date_trunc('month', imp.tariff_date)::date;
  v_ts := imp.tariff_date::timestamptz;

  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    v_cnk := public.normalize_cnk(r->>'cnk');
    v_ean := NULLIF(regexp_replace(coalesce(r->>'ean', ''), '\D', '', 'g'), '');
    v_price := NULLIF(replace(coalesce(r->>'price', ''), ',', '.'), '')::numeric;
    CONTINUE WHEN v_price IS NULL OR (v_cnk IS NULL AND v_ean IS NULL);
    v_sup := NULLIF(trim(coalesce(r->>'supplier', '')), '');
    IF v_sup IS NOT NULL AND NOT public._supplier_matches_source(v_sup, imp.source_id) THEN
      n_skip_other := n_skip_other + 1; CONTINUE;
    END IF;
    IF v_sup IS NULL AND _supplier_filter AND NOT _include_no_supplier THEN
      n_skip_none := n_skip_none + 1; CONTINUE;
    END IF;
    n_rows := n_rows + 1;

    v_pid := NULL;
    IF v_cnk IS NOT NULL THEN SELECT id INTO v_pid FROM products WHERE public.normalize_cnk(cnk_code) = v_cnk ORDER BY is_active DESC NULLS LAST LIMIT 1; END IF;
    IF v_pid IS NULL AND v_ean IS NOT NULL THEN SELECT id INTO v_pid FROM products WHERE gtin = v_ean ORDER BY is_active DESC NULLS LAST LIMIT 1; END IF;

    v_mp := NULL;
    IF v_cnk IS NOT NULL THEN SELECT * INTO v_mp FROM market_prices WHERE source_id = imp.source_id AND public.normalize_cnk(cnk) = v_cnk LIMIT 1; END IF;
    IF v_mp.id IS NULL AND v_ean IS NOT NULL THEN SELECT * INTO v_mp FROM market_prices WHERE source_id = imp.source_id AND ean = v_ean LIMIT 1; END IF;

    IF v_mp.id IS NOT NULL THEN
      INSERT INTO market_price_import_archive (import_id, kind, source_id, row_id, old_row)
      VALUES (_import_id, 'price_updated', imp.source_id, v_mp.id::text, to_jsonb(v_mp));
      UPDATE market_prices SET prix_pharmacien = v_price, product_id = coalesce(v_pid, product_id),
        is_matched = (coalesce(v_pid, product_id) IS NOT NULL), imported_at = v_ts, period = v_period WHERE id = v_mp.id;
      n_changed := n_changed + 1;
    ELSE
      INSERT INTO market_prices (source_id, product_id, cnk, ean, product_name_source, prix_pharmacien, is_matched, imported_at, period)
      VALUES (imp.source_id, v_pid, v_cnk, v_ean, r->>'name', v_price, v_pid IS NOT NULL, v_ts, v_period) RETURNING id INTO v_new_id;
      INSERT INTO market_price_import_archive (import_id, kind, source_id, row_id, old_row)
      VALUES (_import_id, 'price_inserted', imp.source_id, v_new_id::text, NULL);
      n_ins := n_ins + 1;
    END IF;

    IF v_pid IS NULL THEN
      IF jsonb_array_length(unmatched) < 2000 THEN
        unmatched := unmatched || jsonb_build_object('cnk', v_cnk, 'ean', v_ean, 'name', r->>'name', 'price', v_price);
      END IF;
      CONTINUE;
    END IF;
    n_matched := n_matched + 1;

    SELECT price_excl_vat INTO v_prev FROM market_price_history
      WHERE source_id = imp.source_id AND product_id = v_pid AND period = (v_period - interval '1 month')::date;
    IF v_prev IS NOT NULL AND v_prev > 0 AND abs(v_price - v_prev) / v_prev > 0.15 THEN
      deltas := deltas || jsonb_build_object('product_id', v_pid, 'cnk', v_cnk, 'prev', v_prev, 'new', v_price,
        'pct', round((v_price - v_prev) / v_prev * 100, 1));
    END IF;

    SELECT * INTO v_hist FROM market_price_history WHERE source_id = imp.source_id AND product_id = v_pid AND period = v_period;
    IF FOUND THEN
      INSERT INTO market_price_import_archive (import_id, kind, source_id, row_id, old_row)
      VALUES (_import_id, 'history_updated', imp.source_id, v_hist.id::text, to_jsonb(v_hist));
      UPDATE market_price_history SET price_excl_vat = v_price, imported_at = now() WHERE id = v_hist.id;
    ELSE
      INSERT INTO market_price_history (source_id, product_id, period, price_excl_vat, imported_at)
      VALUES (imp.source_id, v_pid, v_period, v_price, now()) RETURNING id INTO v_hist_id;
      INSERT INTO market_price_import_archive (import_id, kind, source_id, row_id, old_row)
      VALUES (_import_id, 'history_inserted', imp.source_id, v_hist_id::text, NULL);
    END IF;
  END LOOP;

  UPDATE market_price_imports SET rows_count = rows_count + n_rows, changed_count = changed_count + n_changed,
    inserted_count = inserted_count + n_ins WHERE id = _import_id;

  RETURN jsonb_build_object('rows', n_rows, 'matched', n_matched, 'changed', n_changed, 'inserted', n_ins,
    'skipped_no_supplier', n_skip_none, 'skipped_other_supplier', n_skip_other, 'unmatched', unmatched, 'deltas', deltas);
END $function$;

CREATE OR REPLACE FUNCTION public.admin_finish_wholesaler_import(_import_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE imp market_price_imports%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE market_price_imports SET status = CASE WHEN rows_count = 0 THEN 'empty' ELSE 'done' END
    WHERE id = _import_id AND status = 'running' RETURNING * INTO imp;
  IF FOUND THEN
    INSERT INTO audit_logs (action, user_id, module, entity_type, entity_id, metadata)
    VALUES ('wholesaler_prices_import', auth.uid(), 'scan', 'market_price_sources', imp.source_id,
      jsonb_build_object('import_id', imp.id, 'tariff_date', imp.tariff_date, 'file', imp.file_name,
        'rows', imp.rows_count, 'changed', imp.changed_count, 'inserted', imp.inserted_count, 'status', imp.status));
    IF imp.rows_count = 0 THEN
      RAISE EXCEPTION 'Import bloqué : aucune ligne ne correspond à la source choisie' USING ERRCODE = '22023';
    END IF;
  END IF;
END $function$;

REVOKE ALL ON FUNCTION public.admin_preview_wholesaler_import(uuid, jsonb, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_import_wholesaler_prices_v2(uuid, jsonb, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_wholesaler_import(uuid, jsonb, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_import_wholesaler_prices_v2(uuid, jsonb, boolean, boolean) TO authenticated, service_role;