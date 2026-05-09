
CREATE TABLE IF NOT EXISTS public.product_category_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  current_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  suggested_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('keyword_mismatch','brand_outlier','missing_category')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','blocking')),
  score numeric NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','resolved')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  dismissed_by uuid,
  dismiss_note text,
  UNIQUE (product_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_pca_status ON public.product_category_anomalies(status);
CREATE INDEX IF NOT EXISTS idx_pca_product ON public.product_category_anomalies(product_id);
CREATE INDEX IF NOT EXISTS idx_pca_reason ON public.product_category_anomalies(reason);

ALTER TABLE public.product_category_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_pca" ON public.product_category_anomalies;
CREATE POLICY "admins_select_pca" ON public.product_category_anomalies
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins_update_pca" ON public.product_category_anomalies;
CREATE POLICY "admins_update_pca" ON public.product_category_anomalies
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins_delete_pca" ON public.product_category_anomalies;
CREATE POLICY "admins_delete_pca" ON public.product_category_anomalies
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public._cat_tokens(_label text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT t)
    FILTER (WHERE length(t) >= 3 AND t NOT IN (
      'les','des','une','aux','par','pour','sur','dans','avec','sans','sous','plus','moins','tres','etre','est','son','sas','sarl','prl','spa','srl','bio','new','mini','maxi','pack','lot','box'
    )),
    ARRAY[]::text[]
  )
  FROM unnest(
    string_to_array(
      regexp_replace(lower(unaccent(coalesce(_label,''))), '[^a-z0-9]+', ' ', 'g'),
      ' '
    )
  ) AS t
  WHERE t <> '';
$$;

CREATE OR REPLACE FUNCTION public.detect_product_category_anomalies(
  _product_id uuid DEFAULT NULL,
  _limit int DEFAULT NULL
)
RETURNS TABLE (
  scanned int,
  flagged int,
  closed int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scanned int := 0;
  v_flagged int := 0;
  v_closed int := 0;
  v_just_closed int := 0;
  rec record;
  v_prod_tokens text[];
  v_cat_tokens text[];
  v_overlap int;
  v_best_alt uuid;
  v_best_alt_overlap int;
  v_brand_dominant_cat uuid;
  v_brand_dominant_ratio numeric;
  v_brand_total int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  FOR rec IN
    SELECT p.id, p.name, p.brand_id, p.primary_category_id
    FROM products p
    WHERE p.is_active = true
      AND (_product_id IS NULL OR p.id = _product_id)
    ORDER BY p.id
    LIMIT COALESCE(_limit, 10000)
  LOOP
    v_scanned := v_scanned + 1;

    IF rec.primary_category_id IS NULL THEN
      INSERT INTO product_category_anomalies (product_id, current_category_id, reason, severity, score, details, status)
      VALUES (rec.id, NULL, 'missing_category', 'warning', 1.0,
              jsonb_build_object('product_name', rec.name), 'open')
      ON CONFLICT (product_id, reason) DO UPDATE
        SET status = CASE WHEN product_category_anomalies.status = 'dismissed' THEN 'dismissed' ELSE 'open' END,
            detected_at = now(),
            details = EXCLUDED.details;
      v_flagged := v_flagged + 1;
      CONTINUE;
    ELSE
      UPDATE product_category_anomalies
        SET status = 'resolved', resolved_at = now()
        WHERE product_id = rec.id AND reason = 'missing_category' AND status = 'open';
    END IF;

    v_prod_tokens := public._cat_tokens(rec.name);
    IF array_length(v_prod_tokens, 1) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT public._cat_tokens(coalesce(c.name_fr, c.name) || ' ' || coalesce(c.name_en, '') || ' ' || coalesce(c.slug, ''))
      INTO v_cat_tokens
      FROM categories c WHERE c.id = rec.primary_category_id;

    SELECT cardinality(ARRAY(SELECT unnest(v_prod_tokens) INTERSECT SELECT unnest(coalesce(v_cat_tokens, ARRAY[]::text[])))) INTO v_overlap;

    SELECT c.id, cardinality(ARRAY(
      SELECT unnest(v_prod_tokens)
      INTERSECT
      SELECT unnest(public._cat_tokens(coalesce(c.name_fr, c.name) || ' ' || coalesce(c.name_en, '') || ' ' || coalesce(c.slug, '')))
    )) AS ov
    INTO v_best_alt, v_best_alt_overlap
    FROM categories c
    WHERE c.is_active = true
      AND c.id <> rec.primary_category_id
      AND coalesce(c.status, 'active') = 'active'
    ORDER BY ov DESC NULLS LAST
    LIMIT 1;

    IF v_overlap = 0 AND COALESCE(v_best_alt_overlap, 0) >= 2 THEN
      INSERT INTO product_category_anomalies
        (product_id, current_category_id, suggested_category_id, reason, severity, score, details, status)
      VALUES (rec.id, rec.primary_category_id, v_best_alt, 'keyword_mismatch', 'warning',
              LEAST(1.0, v_best_alt_overlap::numeric / GREATEST(1, array_length(v_prod_tokens, 1))),
              jsonb_build_object(
                'product_name', rec.name,
                'product_tokens', v_prod_tokens,
                'current_overlap', v_overlap,
                'suggested_overlap', v_best_alt_overlap
              ),
              'open')
      ON CONFLICT (product_id, reason) DO UPDATE
        SET status = CASE WHEN product_category_anomalies.status = 'dismissed' THEN 'dismissed' ELSE 'open' END,
            current_category_id = EXCLUDED.current_category_id,
            suggested_category_id = EXCLUDED.suggested_category_id,
            score = EXCLUDED.score,
            details = EXCLUDED.details,
            detected_at = now();
      v_flagged := v_flagged + 1;
    ELSE
      UPDATE product_category_anomalies
        SET status = 'resolved', resolved_at = now()
        WHERE product_id = rec.id AND reason = 'keyword_mismatch' AND status = 'open';
      GET DIAGNOSTICS v_just_closed = ROW_COUNT;
      v_closed := v_closed + v_just_closed;
    END IF;

    IF rec.brand_id IS NOT NULL THEN
      SELECT primary_category_id, total::numeric / NULLIF(grand_total, 0), total
      INTO v_brand_dominant_cat, v_brand_dominant_ratio, v_brand_total
      FROM (
        SELECT p2.primary_category_id,
               count(*) AS total,
               sum(count(*)) OVER () AS grand_total
        FROM products p2
        WHERE p2.brand_id = rec.brand_id
          AND p2.is_active = true
          AND p2.primary_category_id IS NOT NULL
        GROUP BY p2.primary_category_id
        ORDER BY count(*) DESC
        LIMIT 1
      ) sub;

      IF v_brand_dominant_cat IS NOT NULL
         AND v_brand_dominant_cat <> rec.primary_category_id
         AND v_brand_dominant_ratio >= 0.7
         AND v_brand_total >= 5 THEN
        INSERT INTO product_category_anomalies
          (product_id, current_category_id, suggested_category_id, reason, severity, score, details, status)
        VALUES (rec.id, rec.primary_category_id, v_brand_dominant_cat, 'brand_outlier', 'warning',
                v_brand_dominant_ratio,
                jsonb_build_object(
                  'product_name', rec.name,
                  'brand_id', rec.brand_id,
                  'dominant_ratio', v_brand_dominant_ratio,
                  'dominant_total', v_brand_total
                ),
                'open')
        ON CONFLICT (product_id, reason) DO UPDATE
          SET status = CASE WHEN product_category_anomalies.status = 'dismissed' THEN 'dismissed' ELSE 'open' END,
              current_category_id = EXCLUDED.current_category_id,
              suggested_category_id = EXCLUDED.suggested_category_id,
              score = EXCLUDED.score,
              details = EXCLUDED.details,
              detected_at = now();
        v_flagged := v_flagged + 1;
      ELSE
        UPDATE product_category_anomalies
          SET status = 'resolved', resolved_at = now()
          WHERE product_id = rec.id AND reason = 'brand_outlier' AND status = 'open';
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_scanned, v_flagged, v_closed;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_product_category_anomalies(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_product_category_anomalies(uuid, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_product_category_anomalies(_product_ids uuid[])
RETURNS TABLE (
  product_id uuid,
  reason text,
  severity text,
  score numeric,
  current_category_id uuid,
  suggested_category_id uuid,
  details jsonb,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.product_id, a.reason, a.severity, a.score,
         a.current_category_id, a.suggested_category_id, a.details, a.status
  FROM product_category_anomalies a
  WHERE a.product_id = ANY(_product_ids)
    AND a.status = 'open';
$$;

REVOKE ALL ON FUNCTION public.get_product_category_anomalies(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_category_anomalies(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dismiss_product_category_anomaly(_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  UPDATE product_category_anomalies
    SET status = 'dismissed', dismissed_by = auth.uid(), dismiss_note = _note, resolved_at = now()
    WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_product_category_anomaly(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_product_category_anomaly(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_product_category_anomaly_suggestion(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anom record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  SELECT * INTO v_anom FROM product_category_anomalies WHERE id = _id;
  IF NOT FOUND OR v_anom.suggested_category_id IS NULL THEN
    RAISE EXCEPTION 'Anomalie introuvable ou sans suggestion';
  END IF;
  UPDATE products
    SET primary_category_id = v_anom.suggested_category_id, manual_mapping_validated = true
    WHERE id = v_anom.product_id;
  UPDATE product_category_anomalies
    SET status = 'resolved', resolved_at = now()
    WHERE product_id = v_anom.product_id AND status = 'open';
END;
$$;

REVOKE ALL ON FUNCTION public.apply_product_category_anomaly_suggestion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_product_category_anomaly_suggestion(uuid) TO authenticated;
