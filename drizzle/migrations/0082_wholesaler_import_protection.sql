CREATE TABLE public.market_price_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.market_price_sources(id),
  tariff_date date NOT NULL,
  file_name text,
  rows_count int NOT NULL DEFAULT 0,
  changed_count int NOT NULL DEFAULT 0,
  inserted_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reverted_at timestamptz,
  reverted_by uuid
);
GRANT SELECT ON public.market_price_imports TO authenticated;
GRANT ALL ON public.market_price_imports TO service_role;
ALTER TABLE public.market_price_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY mpi_admin_read ON public.market_price_imports FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.market_price_import_archive (
  id bigserial PRIMARY KEY,
  import_id uuid NOT NULL REFERENCES public.market_price_imports(id),
  kind text NOT NULL,
  source_id uuid NOT NULL,
  row_id text NOT NULL,
  old_row jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.market_price_import_archive (import_id);
GRANT SELECT ON public.market_price_import_archive TO authenticated;
GRANT ALL ON public.market_price_import_archive TO service_role;
ALTER TABLE public.market_price_import_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY mpia_admin_read ON public.market_price_import_archive FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public._supplier_matches_source(_supplier text, _source_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    SELECT lower(regexp_replace(split_part(ms.name, ' ', 1), '[^a-zA-Z0-9]', '', 'g')) a,
           lower(regexp_replace(split_part(coalesce(wp.display_name, ''), ' ', 1), '[^a-zA-Z0-9]', '', 'g')) b
    FROM market_price_sources ms LEFT JOIN wholesaler_profiles wp ON wp.id = ms.wholesaler_profile_id
    WHERE ms.id = _source_id
  ), v AS (SELECT lower(regexp_replace(coalesce(_supplier, ''), '[^a-zA-Z0-9]', '', 'g')) x)
  SELECT CASE WHEN (SELECT x FROM v) = '' THEN true ELSE EXISTS (
    SELECT 1 FROM s, v WHERE (length(a) >= 3 AND (position(a in x) > 0 OR position(x in a) > 0))
                        OR (length(b) >= 3 AND (position(b in x) > 0 OR position(x in b) > 0))) END
$$;

CREATE OR REPLACE FUNCTION public.admin_preview_wholesaler_import(_source_id uuid, _rows jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb; v_cnk text; v_ean text; v_price numeric; v_old numeric; v_found boolean;
  n int := 0; n_new int := 0; n_changed int := 0; sum_pct numeric := 0; n_pct int := 0;
  suppliers jsonb := '{}'::jsonb; bad jsonb := '{}'::jsonb; v_sup text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    v_sup := NULLIF(trim(coalesce(r->>'supplier', '')), '');
    IF v_sup IS NOT NULL THEN
      suppliers := jsonb_set(suppliers, ARRAY[v_sup], to_jsonb(coalesce((suppliers->>v_sup)::int, 0) + 1));
      IF NOT public._supplier_matches_source(v_sup, _source_id) THEN
        bad := jsonb_set(bad, ARRAY[v_sup], to_jsonb(coalesce((bad->>v_sup)::int, 0) + 1));
      END IF;
    END IF;
    v_cnk := public.normalize_cnk(r->>'cnk');
    v_ean := NULLIF(regexp_replace(coalesce(r->>'ean', ''), '\D', '', 'g'), '');
    v_price := NULLIF(replace(coalesce(r->>'price', ''), ',', '.'), '')::numeric;
    CONTINUE WHEN v_price IS NULL OR (v_cnk IS NULL AND v_ean IS NULL);
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
    'suppliers', suppliers, 'mismatched_suppliers', bad);
END $$;

CREATE OR REPLACE FUNCTION public.admin_start_wholesaler_import(_source_id uuid, _tariff_date date, _file_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _source_id IS NULL OR _tariff_date IS NULL THEN RAISE EXCEPTION 'Source et date du tarif obligatoires'; END IF;
  IF _tariff_date > current_date THEN RAISE EXCEPTION 'Date du tarif dans le futur'; END IF;
  INSERT INTO market_price_imports (source_id, tariff_date, file_name, created_by)
  VALUES (_source_id, _tariff_date, _file_name, auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_import_wholesaler_prices_v2(_import_id uuid, _rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  imp market_price_imports%ROWTYPE;
  r jsonb; v_cnk text; v_ean text; v_price numeric; v_pid uuid; v_mp market_prices%ROWTYPE; v_new_id uuid;
  v_hist market_price_history%ROWTYPE; v_hist_id bigint; v_prev numeric; v_sup text;
  n_rows int := 0; n_matched int := 0; n_changed int := 0; n_ins int := 0;
  unmatched jsonb := '[]'::jsonb; deltas jsonb := '[]'::jsonb; v_period date; v_ts timestamptz;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO imp FROM market_price_imports WHERE id = _import_id FOR UPDATE;
  IF NOT FOUND OR imp.status <> 'running' THEN RAISE EXCEPTION 'Import introuvable ou clos'; END IF;
  v_period := date_trunc('month', imp.tariff_date)::date;
  v_ts := imp.tariff_date::timestamptz;

  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    v_sup := NULLIF(trim(coalesce(r->>'supplier', '')), '');
    IF v_sup IS NOT NULL AND NOT public._supplier_matches_source(v_sup, imp.source_id) THEN
      RAISE EXCEPTION 'Fichier refusé : la colonne Fournisseur indique « % », incompatible avec la source choisie', v_sup USING ERRCODE = '22023';
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    v_cnk := public.normalize_cnk(r->>'cnk');
    v_ean := NULLIF(regexp_replace(coalesce(r->>'ean', ''), '\D', '', 'g'), '');
    v_price := NULLIF(replace(coalesce(r->>'price', ''), ',', '.'), '')::numeric;
    CONTINUE WHEN v_price IS NULL OR (v_cnk IS NULL AND v_ean IS NULL);
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

  RETURN jsonb_build_object('rows', n_rows, 'matched', n_matched, 'changed', n_changed, 'inserted', n_ins, 'unmatched', unmatched, 'deltas', deltas);
END $$;

CREATE OR REPLACE FUNCTION public.admin_finish_wholesaler_import(_import_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE imp market_price_imports%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE market_price_imports SET status = 'done' WHERE id = _import_id AND status = 'running' RETURNING * INTO imp;
  IF FOUND THEN
    INSERT INTO audit_logs (action, user_id, module, entity_type, entity_id, metadata)
    VALUES ('wholesaler_prices_import', auth.uid(), 'scan', 'market_price_sources', imp.source_id,
      jsonb_build_object('import_id', imp.id, 'tariff_date', imp.tariff_date, 'file', imp.file_name,
        'rows', imp.rows_count, 'changed', imp.changed_count, 'inserted', imp.inserted_count));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_revert_wholesaler_import(_import_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE imp market_price_imports%ROWTYPE; a record; n_restored int := 0; n_removed int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO imp FROM market_price_imports WHERE id = _import_id FOR UPDATE;
  IF NOT FOUND OR imp.reverted_at IS NOT NULL THEN RAISE EXCEPTION 'Import introuvable ou déjà annulé'; END IF;
  IF EXISTS (SELECT 1 FROM market_price_imports WHERE source_id = imp.source_id AND created_at > imp.created_at AND reverted_at IS NULL) THEN
    RAISE EXCEPTION 'Un import plus récent existe pour cette source : annulez-le d''abord';
  END IF;
  FOR a IN SELECT * FROM market_price_import_archive WHERE import_id = _import_id ORDER BY id DESC LOOP
    IF a.kind = 'price_updated' THEN
      UPDATE market_prices m SET
        prix_pharmacien = (a.old_row->>'prix_pharmacien')::numeric,
        product_id = (a.old_row->>'product_id')::uuid,
        is_matched = (a.old_row->>'is_matched')::boolean,
        imported_at = (a.old_row->>'imported_at')::timestamptz,
        period = (a.old_row->>'period')::date
      WHERE m.id = (a.row_id)::uuid;
      n_restored := n_restored + 1;
    ELSIF a.kind = 'price_inserted' THEN
      DELETE FROM market_prices WHERE id = (a.row_id)::uuid; n_removed := n_removed + 1;
    ELSIF a.kind = 'history_updated' THEN
      UPDATE market_price_history SET price_excl_vat = (a.old_row->>'price_excl_vat')::numeric,
        imported_at = (a.old_row->>'imported_at')::timestamptz WHERE id = (a.row_id)::bigint;
    ELSIF a.kind = 'history_inserted' THEN
      DELETE FROM market_price_history WHERE id = (a.row_id)::bigint;
    END IF;
  END LOOP;
  UPDATE market_price_imports SET status = 'reverted', reverted_at = now(), reverted_by = auth.uid() WHERE id = _import_id;
  INSERT INTO audit_logs (action, user_id, module, entity_type, entity_id, metadata)
  VALUES ('wholesaler_prices_import_reverted', auth.uid(), 'scan', 'market_price_sources', imp.source_id,
    jsonb_build_object('import_id', imp.id, 'restored', n_restored, 'removed', n_removed));
  RETURN jsonb_build_object('restored', n_restored, 'removed', n_removed);
END $$;

REVOKE ALL ON FUNCTION public._supplier_matches_source(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_preview_wholesaler_import(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_start_wholesaler_import(uuid, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_import_wholesaler_prices_v2(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_finish_wholesaler_import(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revert_wholesaler_import(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_wholesaler_import(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_start_wholesaler_import(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_wholesaler_prices_v2(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finish_wholesaler_import(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revert_wholesaler_import(uuid) TO authenticated;
