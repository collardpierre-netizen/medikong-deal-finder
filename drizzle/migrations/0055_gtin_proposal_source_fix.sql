CREATE OR REPLACE FUNCTION public.admin_review_gtin_proposals(_ids uuid[], _approve boolean)
 RETURNS TABLE(id uuid, outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _p record;
  _ean_type_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT m.id INTO _ean_type_id
  FROM public.market_code_types m
  WHERE upper(m.code) IN ('EAN', 'GTIN', 'EAN13') AND m.is_active = true
  ORDER BY CASE upper(m.code) WHEN 'EAN' THEN 0 WHEN 'EAN13' THEN 1 ELSE 2 END
  LIMIT 1;
  IF _ean_type_id IS NULL THEN RAISE EXCEPTION 'ean_code_type_missing'; END IF;

  FOR _p IN SELECT * FROM public.product_gtin_proposals g WHERE g.id = ANY(_ids) AND g.status = 'pending' LOOP
    IF NOT _approve THEN
      UPDATE public.product_gtin_proposals SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now() WHERE product_gtin_proposals.id = _p.id;
      id := _p.id; outcome := 'rejected'; RETURN NEXT; CONTINUE;
    END IF;

    IF _p.proposed_gtin = '0000000000000'
       OR EXISTS (SELECT 1 FROM public.products x WHERE regexp_replace(coalesce(x.gtin, ''), '[^0-9]', '', 'g') = regexp_replace(_p.proposed_gtin, '[^0-9]', '', 'g') AND x.id <> _p.product_id)
       OR EXISTS (SELECT 1 FROM public.product_market_codes x WHERE regexp_replace(x.code_value, '[^0-9]', '', 'g') = regexp_replace(_p.proposed_gtin, '[^0-9]', '', 'g') AND x.product_id <> _p.product_id) THEN
      UPDATE public.product_gtin_proposals SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now() WHERE product_gtin_proposals.id = _p.id;
      id := _p.id; outcome := 'conflict'; RETURN NEXT; CONTINUE;
    END IF;

    INSERT INTO public.product_market_codes (
      product_id, market_code_type_id, code_value, verified, source, updated_by,
      packaging_level, units_per_pack
    ) VALUES (
      _p.product_id, _ean_type_id, regexp_replace(_p.proposed_gtin, '[^0-9]', '', 'g'), true,
      CASE WHEN _p.proposal_source = 'scan' THEN 'scan' ELSE 'import_febelco' END,
      auth.uid(), _p.packaging_level, _p.units_per_pack
    )
    ON CONFLICT (product_id, market_code_type_id, code_value) DO UPDATE
      SET verified = true,
          source = EXCLUDED.source,
          updated_by = auth.uid(),
          updated_at = now(),
          packaging_level = EXCLUDED.packaging_level,
          units_per_pack = EXCLUDED.units_per_pack;

    UPDATE public.product_gtin_proposals SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() WHERE product_gtin_proposals.id = _p.id;
    INSERT INTO public.audit_logs (user_id, action, module, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'gtin_proposal_approved', 'scan_imports', 'product', _p.product_id,
            jsonb_build_object('gtin', _p.proposed_gtin, 'cnk', _p.matched_cnk, 'source_id', _p.source_id,
              'proposal_id', _p.id, 'packaging_level', _p.packaging_level, 'units_per_pack', _p.units_per_pack));
    id := _p.id; outcome := 'approved'; RETURN NEXT;
  END LOOP;
END $function$;