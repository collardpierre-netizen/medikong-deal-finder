CREATE OR REPLACE FUNCTION public.normalize_gtin(_gtin text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO 'public' AS $$
  SELECT NULLIF(ltrim(regexp_replace(regexp_replace(btrim(coalesce(_gtin,'')), '[.,]0+$', ''), '[^0-9]', '', 'g'), '0'), '')
$$;

ALTER TABLE public.product_market_codes DROP CONSTRAINT IF EXISTS product_market_codes_packaging_level_check;

DROP INDEX IF EXISTS public.product_market_codes_normalized_code_unique;
CREATE UNIQUE INDEX product_market_codes_normalized_code_unique
  ON public.product_market_codes (market_code_type_id, public.normalize_gtin(code_value))
  WHERE public.normalize_gtin(code_value) IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_normalize_gtin_idx ON public.products (public.normalize_gtin(gtin));

CREATE OR REPLACE FUNCTION public.scan_find_products_by_code(_code text)
RETURNS TABLE(product_id uuid, origin text, packaging_level text, units_per_pack integer)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT p.id, 'gtin', NULL::text, NULL::integer FROM public.products p
   WHERE public.normalize_gtin(_code) IS NOT NULL AND public.normalize_gtin(p.gtin) = public.normalize_gtin(_code) AND p.is_active
  UNION ALL
  SELECT c.product_id, 'market_code', c.packaging_level, c.units_per_pack FROM public.product_market_codes c
   WHERE public.normalize_gtin(_code) IS NOT NULL AND public.normalize_gtin(c.code_value) = public.normalize_gtin(_code)
$$;
REVOKE ALL ON FUNCTION public.scan_find_products_by_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_find_products_by_code(text) TO service_role;

CREATE OR REPLACE FUNCTION public.scan_create_gtin_proposal(_scan_event_id uuid, _product_id uuid, _packaging_level text DEFAULT 'unit'::text, _units_per_pack integer DEFAULT 1)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _ev public.scan_events%ROWTYPE;
  _proposal_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _packaging_level NOT IN ('unit', 'pack', 'carton') OR _units_per_pack < 1 THEN
    RAISE EXCEPTION 'invalid_packaging';
  END IF;
  SELECT * INTO _ev FROM public.scan_events WHERE id = _scan_event_id;
  IF NOT FOUND OR public.normalize_gtin(_ev.gtin) IS NULL THEN RAISE EXCEPTION 'scan_not_found'; END IF;
  IF NOT (_ev.customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = _uid
    UNION SELECT x FROM public.current_user_buyer_account_ids() x
  )) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = _product_id AND p.is_active = true) THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.products p WHERE public.normalize_gtin(p.gtin) = public.normalize_gtin(_ev.gtin)
    UNION ALL
    SELECT 1 FROM public.product_market_codes c WHERE public.normalize_gtin(c.code_value) = public.normalize_gtin(_ev.gtin)
  ) THEN RAISE EXCEPTION 'code_already_used'; END IF;

  INSERT INTO public.product_gtin_proposals (
    product_id, proposed_gtin, matched_cnk, status, scan_event_id, proposed_by,
    packaging_level, units_per_pack, proposal_source
  )
  SELECT p.id, _ev.gtin, p.cnk_code, 'pending', _ev.id, _uid, _packaging_level, _units_per_pack, 'scan'
  FROM public.products p WHERE p.id = _product_id
  ON CONFLICT (product_id, proposed_gtin) DO UPDATE
    SET scan_event_id = EXCLUDED.scan_event_id, proposed_by = EXCLUDED.proposed_by,
        packaging_level = EXCLUDED.packaging_level, units_per_pack = EXCLUDED.units_per_pack,
        proposal_source = 'scan', status = 'pending', reviewed_by = NULL, reviewed_at = NULL
  RETURNING id INTO _proposal_id;

  UPDATE public.scan_events SET product_id = _product_id, match_status = 'proposed_match', action = 'gtin_proposal'
  WHERE id = _scan_event_id;
  RETURN _proposal_id;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_review_gtin_proposals(_ids uuid[], _approve boolean)
 RETURNS TABLE(id uuid, outcome text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _p record;
  _ean_type_id uuid;
  _norm text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT m.id INTO _ean_type_id FROM public.market_code_types m
  WHERE upper(m.code) IN ('EAN', 'GTIN', 'EAN13') AND m.is_active = true
  ORDER BY CASE upper(m.code) WHEN 'EAN' THEN 0 WHEN 'EAN13' THEN 1 ELSE 2 END LIMIT 1;
  IF _ean_type_id IS NULL THEN RAISE EXCEPTION 'ean_code_type_missing'; END IF;

  FOR _p IN SELECT * FROM public.product_gtin_proposals g WHERE g.id = ANY(_ids) AND g.status = 'pending' LOOP
    IF NOT _approve THEN
      UPDATE public.product_gtin_proposals SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now() WHERE product_gtin_proposals.id = _p.id;
      id := _p.id; outcome := 'rejected'; RETURN NEXT; CONTINUE;
    END IF;
    _norm := public.normalize_gtin(_p.proposed_gtin);
    IF _norm IS NULL
       OR EXISTS (SELECT 1 FROM public.products x WHERE public.normalize_gtin(x.gtin) = _norm AND x.id <> _p.product_id)
       OR EXISTS (SELECT 1 FROM public.product_market_codes x WHERE public.normalize_gtin(x.code_value) = _norm AND x.product_id <> _p.product_id) THEN
      UPDATE public.product_gtin_proposals SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now() WHERE product_gtin_proposals.id = _p.id;
      id := _p.id; outcome := 'conflict'; RETURN NEXT; CONTINUE;
    END IF;

    INSERT INTO public.product_market_codes (
      product_id, market_code_type_id, code_value, verified, source, updated_by, packaging_level, units_per_pack
    ) VALUES (
      _p.product_id, _ean_type_id, regexp_replace(regexp_replace(btrim(_p.proposed_gtin), '[.,]0+$', ''), '[^0-9]', '', 'g'), true,
      CASE WHEN _p.proposal_source = 'scan' THEN 'scan' ELSE 'import_febelco' END,
      auth.uid(), _p.packaging_level, _p.units_per_pack
    )
    ON CONFLICT (product_id, market_code_type_id, code_value) DO UPDATE
      SET verified = true, source = EXCLUDED.source, updated_by = auth.uid(), updated_at = now(),
          packaging_level = EXCLUDED.packaging_level, units_per_pack = EXCLUDED.units_per_pack;

    UPDATE public.product_gtin_proposals SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() WHERE product_gtin_proposals.id = _p.id;
    INSERT INTO public.audit_logs (user_id, action, module, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'gtin_proposal_approved', 'scan_imports', 'product', _p.product_id,
            jsonb_build_object('gtin', _p.proposed_gtin, 'cnk', _p.matched_cnk, 'source_id', _p.source_id,
              'proposal_id', _p.id, 'packaging_level', _p.packaging_level, 'units_per_pack', _p.units_per_pack));
    id := _p.id; outcome := 'approved'; RETURN NEXT;
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_generate_gtin_proposals(_source_id uuid, _rows jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _n integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH r AS (
    SELECT DISTINCT public.normalize_cnk(x->>'cnk') AS cnk,
      regexp_replace(regexp_replace(btrim(coalesce(x->>'ean','')), '[.,]0+$', ''), '[^0-9]', '', 'g') AS ean
    FROM jsonb_array_elements(coalesce(_rows, '[]'::jsonb)) x
  ), ok AS (
    SELECT r.* FROM r
    WHERE r.cnk IS NOT NULL AND r.cnk <> ''
      AND length(r.ean) = 13 AND public.normalize_gtin(r.ean) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM products p2 WHERE public.normalize_gtin(p2.gtin) = public.normalize_gtin(r.ean))
      AND NOT EXISTS (SELECT 1 FROM product_market_codes c2 WHERE public.normalize_gtin(c2.code_value) = public.normalize_gtin(r.ean))
  ), ins AS (
    INSERT INTO product_gtin_proposals (product_id, proposed_gtin, source_id, matched_cnk, status)
    SELECT p.id, ok.ean, _source_id, ok.cnk, 'pending'
    FROM ok JOIN products p ON public.normalize_cnk(p.cnk_code) = ok.cnk
    WHERE coalesce(btrim(p.gtin), '') = ''
    ON CONFLICT (product_id, proposed_gtin) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM ins;
  RETURN _n;
END $function$;

CREATE OR REPLACE FUNCTION public.find_product_duplicates()
 RETURNS TABLE(match_key text, match_type text, variant_count integer, product_ids uuid[], product_names text[], gtins text[], cnks text[], offer_counts integer[], has_images boolean[], is_active_flags boolean[])
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can list product duplicates'; END IF;
  RETURN QUERY
  WITH by_gtin AS (
    SELECT public.normalize_gtin(p.gtin) AS k, 'gtin'::text AS t, p.id, p.name, p.gtin, p.cnk_code, p.offer_count, (p.image_urls IS NOT NULL AND array_length(p.image_urls,1) > 0) AS has_img, p.is_active
    FROM public.products p WHERE public.normalize_gtin(p.gtin) IS NOT NULL
  ),
  by_cnk AS (
    SELECT lower(trim(p.cnk_code)) AS k, 'cnk'::text AS t, p.id, p.name, p.gtin, p.cnk_code, p.offer_count, (p.image_urls IS NOT NULL AND array_length(p.image_urls,1) > 0) AS has_img, p.is_active
    FROM public.products p WHERE p.cnk_code IS NOT NULL AND trim(p.cnk_code) <> ''
  ),
  unioned AS (
    SELECT * FROM by_gtin
    UNION ALL
    SELECT * FROM by_cnk WHERE NOT EXISTS (SELECT 1 FROM by_gtin g WHERE g.id = by_cnk.id)
  ),
  grouped AS (
    SELECT k, t, count(*)::int AS c,
      array_agg(id ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS ids,
      array_agg(name ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS names,
      array_agg(gtin ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS gtins,
      array_agg(cnk_code ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS cnks,
      array_agg(COALESCE(offer_count,0) ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS ofc,
      array_agg(has_img ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS himg,
      array_agg(is_active ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS act
    FROM unioned GROUP BY k, t HAVING count(*) > 1
  )
  SELECT k, t, c, ids, names, gtins, cnks, ofc, himg, act FROM grouped ORDER BY c DESC, k;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_market_code(_id uuid, _product_id uuid, _type_id uuid, _code text, _verified boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _old public.product_market_codes%ROWTYPE; _new_id uuid; _clean text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  _clean := btrim(coalesce(_code,''));
  IF _clean = '' THEN RAISE EXCEPTION 'empty_code'; END IF;
  IF _id IS NOT NULL THEN
    SELECT * INTO _old FROM public.product_market_codes WHERE id = _id;
    IF NOT FOUND THEN RAISE EXCEPTION 'code_not_found'; END IF;
    UPDATE public.product_market_codes SET code_value = _clean, verified = _verified, updated_by = auth.uid(), updated_at = now()
     WHERE id = _id RETURNING id INTO _new_id;
    INSERT INTO public.audit_logs (user_id, action, module, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'market_code_updated', 'market_codes', 'product', _old.product_id,
      jsonb_build_object('code_id', _id, 'old_code', _old.code_value, 'new_code', _clean, 'old_verified', _old.verified, 'new_verified', _verified));
  ELSE
    INSERT INTO public.product_market_codes (product_id, market_code_type_id, code_value, verified, source, updated_by)
    VALUES (_product_id, _type_id, _clean, _verified, 'admin', auth.uid()) RETURNING id INTO _new_id;
    INSERT INTO public.audit_logs (user_id, action, module, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'market_code_added', 'market_codes', 'product', _product_id,
      jsonb_build_object('code_id', _new_id, 'code', _clean, 'type_id', _type_id, 'verified', _verified));
  END IF;
  RETURN _new_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_market_code(uuid, uuid, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_market_code(uuid, uuid, uuid, text, boolean) TO authenticated;