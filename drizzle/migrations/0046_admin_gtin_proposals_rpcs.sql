CREATE OR REPLACE FUNCTION public.admin_generate_gtin_proposals(_source_id uuid, _rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH r AS (
    SELECT DISTINCT public.normalize_cnk(x->>'cnk') AS cnk, regexp_replace(coalesce(x->>'ean',''), '\D', '', 'g') AS ean
    FROM jsonb_array_elements(coalesce(_rows, '[]'::jsonb)) x
  ), ok AS (
    SELECT r.* FROM r
    WHERE r.cnk IS NOT NULL AND r.cnk <> ''
      AND length(r.ean) = 13 AND r.ean <> '0000000000000'
      AND NOT EXISTS (SELECT 1 FROM products p2 WHERE p2.gtin = r.ean)
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
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_gtin_proposals(_ids uuid[], _approve boolean)
RETURNS TABLE(id uuid, outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p record;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  FOR _p IN SELECT * FROM product_gtin_proposals g WHERE g.id = ANY(_ids) AND g.status = 'pending' LOOP
    IF NOT _approve THEN
      UPDATE product_gtin_proposals SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now() WHERE product_gtin_proposals.id = _p.id;
      id := _p.id; outcome := 'rejected'; RETURN NEXT; CONTINUE;
    END IF;

    IF _p.proposed_gtin = '0000000000000'
       OR EXISTS (SELECT 1 FROM products x WHERE x.gtin = _p.proposed_gtin AND x.id <> _p.product_id) THEN
      UPDATE product_gtin_proposals SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now() WHERE product_gtin_proposals.id = _p.id;
      id := _p.id; outcome := 'conflict'; RETURN NEXT; CONTINUE;
    END IF;

    UPDATE products SET gtin = _p.proposed_gtin
    WHERE products.id = _p.product_id AND coalesce(btrim(products.gtin), '') = '';
    IF NOT FOUND THEN
      UPDATE product_gtin_proposals SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now() WHERE product_gtin_proposals.id = _p.id;
      id := _p.id; outcome := 'already_filled'; RETURN NEXT; CONTINUE;
    END IF;

    UPDATE product_gtin_proposals SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() WHERE product_gtin_proposals.id = _p.id;
    INSERT INTO audit_logs (user_id, action, module, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'gtin_proposal_approved', 'scan_imports', 'product', _p.product_id,
            jsonb_build_object('gtin', _p.proposed_gtin, 'cnk', _p.matched_cnk, 'source_id', _p.source_id, 'proposal_id', _p.id));
    id := _p.id; outcome := 'approved'; RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.admin_generate_gtin_proposals(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_review_gtin_proposals(uuid[], boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_generate_gtin_proposals(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_gtin_proposals(uuid[], boolean) TO authenticated;