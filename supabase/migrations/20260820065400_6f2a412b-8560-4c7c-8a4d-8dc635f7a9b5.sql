CREATE OR REPLACE FUNCTION public.restock_match_products(_only_missing boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scanned int := 0;
  v_by_ean int := 0;
  v_by_cnk int := 0;
  v_images int := 0;
  v_unmatched int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  CREATE TEMP TABLE _rm_candidates ON COMMIT DROP AS
  SELECT o.id,
         nullif(btrim(o.ean), '') AS ean,
         nullif(btrim(o.cnk), '') AS cnk,
         o.product_image_url,
         o.photo_url,
         o.photos
  FROM public.restock_offers o
  WHERE (NOT _only_missing OR o.matched_product_id IS NULL)
    AND (nullif(btrim(o.ean), '') IS NOT NULL OR nullif(btrim(o.cnk), '') IS NOT NULL);

  SELECT count(*) INTO v_scanned FROM _rm_candidates;

  CREATE TEMP TABLE _rm_matches ON COMMIT DROP AS
  SELECT c.id,
         m.product_id,
         m.image_url,
         m.match_source
  FROM _rm_candidates c
  CROSS JOIN LATERAL (
    SELECT p.id AS product_id, p.image_url, 'ean'::text AS match_source
    FROM public.products p
    WHERE c.ean IS NOT NULL AND btrim(p.gtin) = c.ean
    ORDER BY (p.image_url IS NOT NULL) DESC, p.is_active DESC, p.created_at
    LIMIT 1
  ) m;

  INSERT INTO _rm_matches (id, product_id, image_url, match_source)
  SELECT c.id, m.product_id, m.image_url, 'cnk'
  FROM _rm_candidates c
  CROSS JOIN LATERAL (
    SELECT p.id AS product_id, p.image_url
    FROM public.products p
    WHERE c.cnk IS NOT NULL AND btrim(p.cnk_code) = c.cnk
    ORDER BY (p.image_url IS NOT NULL) DESC, p.is_active DESC, p.created_at
    LIMIT 1
  ) m
  WHERE NOT EXISTS (SELECT 1 FROM _rm_matches x WHERE x.id = c.id);

  WITH upd AS (
    UPDATE public.restock_offers o
    SET matched_product_id = m.product_id,
        product_image_url = CASE
          WHEN nullif(btrim(coalesce(o.product_image_url, '')), '') IS NULL
               AND nullif(btrim(coalesce(o.photo_url, '')), '') IS NULL
               AND coalesce(array_length(o.photos, 1), 0) = 0
               AND m.image_url IS NOT NULL
          THEN m.image_url
          ELSE o.product_image_url
        END,
        updated_at = now()
    FROM _rm_matches m
    WHERE o.id = m.id
    RETURNING m.match_source, (o.product_image_url = m.image_url) AS image_set
  )
  SELECT count(*) FILTER (WHERE match_source = 'ean'),
         count(*) FILTER (WHERE match_source = 'cnk'),
         count(*) FILTER (WHERE image_set)
  INTO v_by_ean, v_by_cnk, v_images
  FROM upd;

  v_unmatched := v_scanned - (v_by_ean + v_by_cnk);

  RETURN jsonb_build_object(
    'scanned', v_scanned,
    'matched_by_ean', v_by_ean,
    'matched_by_cnk', v_by_cnk,
    'images_filled', coalesce(v_images, 0),
    'unmatched', greatest(v_unmatched, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restock_match_products(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restock_match_products(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restock_match_products(boolean) TO service_role;