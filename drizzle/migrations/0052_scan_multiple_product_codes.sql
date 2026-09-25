ALTER TABLE public.product_market_codes
  ADD COLUMN packaging_level text NOT NULL DEFAULT 'unit',
  ADD COLUMN units_per_pack integer NOT NULL DEFAULT 1;

ALTER TABLE public.product_market_codes
  ADD CONSTRAINT product_market_codes_packaging_level_check
    CHECK (packaging_level IN ('unit', 'pack', 'carton')),
  ADD CONSTRAINT product_market_codes_units_per_pack_check
    CHECK (units_per_pack > 0);

ALTER TABLE public.product_market_codes
  DROP CONSTRAINT product_market_codes_product_id_market_code_type_id_key;

ALTER TABLE public.product_market_codes
  ADD CONSTRAINT product_market_codes_product_type_code_key
    UNIQUE (product_id, market_code_type_id, code_value);

CREATE UNIQUE INDEX product_market_codes_normalized_code_unique
  ON public.product_market_codes ((regexp_replace(code_value, '[^0-9]', '', 'g')))
  WHERE regexp_replace(code_value, '[^0-9]', '', 'g') <> '';

ALTER TABLE public.product_gtin_proposals
  ADD COLUMN scan_event_id uuid REFERENCES public.scan_events(id) ON DELETE SET NULL,
  ADD COLUMN proposed_by uuid,
  ADD COLUMN packaging_level text NOT NULL DEFAULT 'unit',
  ADD COLUMN units_per_pack integer NOT NULL DEFAULT 1,
  ADD COLUMN proposal_source text NOT NULL DEFAULT 'import';

ALTER TABLE public.product_gtin_proposals
  ALTER COLUMN matched_cnk DROP NOT NULL;

ALTER TABLE public.product_gtin_proposals
  ADD CONSTRAINT product_gtin_proposals_packaging_level_check
    CHECK (packaging_level IN ('unit', 'pack', 'carton')),
  ADD CONSTRAINT product_gtin_proposals_units_per_pack_check
    CHECK (units_per_pack > 0),
  ADD CONSTRAINT product_gtin_proposals_source_check
    CHECK (proposal_source IN ('import', 'scan'));

CREATE OR REPLACE FUNCTION public.scan_create_gtin_proposal(
  _scan_event_id uuid,
  _product_id uuid,
  _packaging_level text DEFAULT 'unit',
  _units_per_pack integer DEFAULT 1
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF NOT FOUND OR _ev.gtin IS NULL THEN RAISE EXCEPTION 'scan_not_found'; END IF;
  IF NOT (_ev.customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = _uid
    UNION SELECT x FROM public.current_user_buyer_account_ids() x
  )) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = _product_id AND p.is_active = true) THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.products p WHERE regexp_replace(coalesce(p.gtin, ''), '[^0-9]', '', 'g') = _ev.gtin
    UNION ALL
    SELECT 1 FROM public.product_market_codes c WHERE regexp_replace(c.code_value, '[^0-9]', '', 'g') = _ev.gtin
  ) THEN RAISE EXCEPTION 'code_already_used'; END IF;

  INSERT INTO public.product_gtin_proposals (
    product_id, proposed_gtin, matched_cnk, status, scan_event_id, proposed_by,
    packaging_level, units_per_pack, proposal_source
  )
  SELECT p.id, _ev.gtin, p.cnk_code, 'pending', _ev.id, _uid,
         _packaging_level, _units_per_pack, 'scan'
  FROM public.products p WHERE p.id = _product_id
  ON CONFLICT (product_id, proposed_gtin) DO UPDATE
    SET scan_event_id = EXCLUDED.scan_event_id,
        proposed_by = EXCLUDED.proposed_by,
        packaging_level = EXCLUDED.packaging_level,
        units_per_pack = EXCLUDED.units_per_pack,
        proposal_source = 'scan',
        status = 'pending',
        reviewed_by = NULL,
        reviewed_at = NULL
  RETURNING id INTO _proposal_id;

  UPDATE public.scan_events
  SET product_id = _product_id, match_status = 'proposed_match', action = 'gtin_proposal'
  WHERE id = _scan_event_id;

  RETURN _proposal_id;
END $$;

REVOKE ALL ON FUNCTION public.scan_create_gtin_proposal(uuid, uuid, text, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.scan_create_gtin_proposal(uuid, uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_gtin_proposals(_ids uuid[], _approve boolean)
RETURNS TABLE(id uuid, outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      CASE WHEN _p.proposal_source = 'scan' THEN 'scan_admin_approved' ELSE 'import_admin_approved' END,
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
END $$;

REVOKE ALL ON FUNCTION public.admin_review_gtin_proposals(uuid[], boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_gtin_proposals(uuid[], boolean) TO authenticated;