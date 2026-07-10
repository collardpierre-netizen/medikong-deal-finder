
-- ============================================
-- Produits : détection et fusion des doublons
-- ============================================

CREATE OR REPLACE FUNCTION public.normalize_product_gtin(_gtin text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(regexp_replace(COALESCE(_gtin, ''), '\.0+$', ''), '\s+', '', 'g'), '');
$$;

-- ---------------------------------------------------------------
-- find_product_duplicates : groupes par GTIN normalisé ou par CNK
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_product_duplicates()
RETURNS TABLE (
  match_key text,
  match_type text,
  variant_count integer,
  product_ids uuid[],
  product_names text[],
  gtins text[],
  cnks text[],
  offer_counts integer[],
  has_images boolean[],
  is_active_flags boolean[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can list product duplicates';
  END IF;

  RETURN QUERY
  WITH by_gtin AS (
    SELECT public.normalize_product_gtin(p.gtin) AS k, 'gtin'::text AS t, p.id, p.name, p.gtin, p.cnk_code, p.offer_count, (p.image_urls IS NOT NULL AND array_length(p.image_urls,1) > 0) AS has_img, p.is_active
    FROM public.products p
    WHERE public.normalize_product_gtin(p.gtin) IS NOT NULL
  ),
  by_cnk AS (
    SELECT lower(trim(p.cnk_code)) AS k, 'cnk'::text AS t, p.id, p.name, p.gtin, p.cnk_code, p.offer_count, (p.image_urls IS NOT NULL AND array_length(p.image_urls,1) > 0) AS has_img, p.is_active
    FROM public.products p
    WHERE p.cnk_code IS NOT NULL AND trim(p.cnk_code) <> ''
  ),
  unioned AS (
    SELECT * FROM by_gtin
    UNION ALL
    SELECT * FROM by_cnk
    WHERE NOT EXISTS (
      SELECT 1 FROM by_gtin g WHERE g.id = by_cnk.id
    )
  ),
  grouped AS (
    SELECT k, t,
           count(*)::int AS c,
           array_agg(id ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS ids,
           array_agg(name ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS names,
           array_agg(gtin ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS gtins,
           array_agg(cnk_code ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS cnks,
           array_agg(COALESCE(offer_count,0) ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS ofc,
           array_agg(has_img ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS himg,
           array_agg(is_active ORDER BY offer_count DESC NULLS LAST, has_img DESC, is_active DESC) AS act
    FROM unioned
    GROUP BY k, t
    HAVING count(*) > 1
  )
  SELECT k, t, c, ids, names, gtins, cnks, ofc, himg, act
  FROM grouped
  ORDER BY c DESC, k;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_product_duplicates() TO authenticated;

-- ---------------------------------------------------------------
-- merge_products : réassigne tous les FKs de _drop vers _keep,
-- gère les conflits d'unicité en supprimant les lignes du drop
-- qui entreraient en conflit, puis supprime le produit doublon.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merge_products(_keep uuid, _drop uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  updated_total int := 0;
  deleted_conflicts int := 0;
  cnt int;
  keep_name text;
  drop_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can merge products';
  END IF;
  IF _keep = _drop THEN
    RAISE EXCEPTION 'Cannot merge a product with itself';
  END IF;

  SELECT name INTO keep_name FROM public.products WHERE id = _keep;
  SELECT name INTO drop_name FROM public.products WHERE id = _drop;
  IF keep_name IS NULL OR drop_name IS NULL THEN
    RAISE EXCEPTION 'Product not found (keep=%, drop=%)', _keep, _drop;
  END IF;

  -- Boucle sur toutes les FKs qui référencent products.id
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl,
           att.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute att
      ON att.attrelid = c.conrelid AND att.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.products'::regclass
      AND array_length(c.conkey, 1) = 1
  LOOP
    BEGIN
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', r.tbl, r.col, r.col)
        USING _keep, _drop;
      GET DIAGNOSTICS cnt = ROW_COUNT;
      updated_total := updated_total + cnt;
    EXCEPTION WHEN unique_violation OR check_violation THEN
      -- Conflit d'unicité : on supprime les lignes du drop qui bloquent
      EXECUTE format('DELETE FROM %s WHERE %I = $1', r.tbl, r.col) USING _drop;
      GET DIAGNOSTICS cnt = ROW_COUNT;
      deleted_conflicts := deleted_conflicts + cnt;
      -- Retente l'update sur les éventuelles lignes restantes
      BEGIN
        EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', r.tbl, r.col, r.col)
          USING _keep, _drop;
        GET DIAGNOSTICS cnt = ROW_COUNT;
        updated_total := updated_total + cnt;
      EXCEPTION WHEN OTHERS THEN
        EXECUTE format('DELETE FROM %s WHERE %I = $1', r.tbl, r.col) USING _drop;
        GET DIAGNOSTICS cnt = ROW_COUNT;
        deleted_conflicts := deleted_conflicts + cnt;
      END;
    END;
  END LOOP;

  -- Complète les champs vides du keep avec ceux du drop
  UPDATE public.products k
  SET
    gtin       = COALESCE(NULLIF(k.gtin,''), public.normalize_product_gtin(d.gtin)),
    cnk_code   = COALESCE(NULLIF(k.cnk_code,''), d.cnk_code),
    brand_id   = COALESCE(k.brand_id, d.brand_id),
    image_urls = CASE WHEN (k.image_urls IS NULL OR array_length(k.image_urls,1) IS NULL) THEN d.image_urls ELSE k.image_urls END,
    description= COALESCE(NULLIF(k.description,''), d.description)
  FROM public.products d
  WHERE k.id = _keep AND d.id = _drop;

  -- Suppression finale
  DELETE FROM public.products WHERE id = _drop;

  -- Audit
  BEGIN
    INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'merge_products',
      'product',
      _keep,
      jsonb_build_object(
        'keep_id', _keep, 'keep_name', keep_name,
        'drop_id', _drop, 'drop_name', drop_name,
        'rows_reassigned', updated_total,
        'conflicts_deleted', deleted_conflicts
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- audit best-effort
    NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'keep_id', _keep,
    'drop_id', _drop,
    'rows_reassigned', updated_total,
    'conflicts_deleted', deleted_conflicts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_products(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------
-- admin_normalize_product_gtins : nettoie les GTIN Excel "5410...091.0"
-- Merge si une version propre existe déjà, sinon UPDATE le gtin.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_normalize_product_gtins()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  merged int := 0;
  renamed int := 0;
  existing_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can normalize product gtins';
  END IF;

  FOR r IN
    SELECT id, gtin, public.normalize_product_gtin(gtin) AS clean
    FROM public.products
    WHERE gtin ~ '\.'
  LOOP
    IF r.clean IS NULL OR r.clean = r.gtin THEN
      CONTINUE;
    END IF;

    SELECT id INTO existing_id
    FROM public.products
    WHERE gtin = r.clean AND id <> r.id
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      PERFORM public.merge_products(existing_id, r.id);
      merged := merged + 1;
    ELSE
      UPDATE public.products SET gtin = r.clean WHERE id = r.id;
      renamed := renamed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('merged', merged, 'renamed', renamed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_normalize_product_gtins() TO authenticated;

-- ---------------------------------------------------------------
-- auto_merge_product_duplicates : fusionne tous les groupes
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_merge_product_duplicates(_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g record;
  merges int := 0;
  groups int := 0;
  i int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can auto-merge product duplicates';
  END IF;

  FOR g IN SELECT * FROM public.find_product_duplicates() LOOP
    groups := groups + 1;
    IF _dry_run THEN CONTINUE; END IF;
    -- product_ids[1] est le canonique (tri par offer_count desc, has_img, is_active)
    FOR i IN 2 .. array_length(g.product_ids, 1) LOOP
      PERFORM public.merge_products(g.product_ids[1], g.product_ids[i]);
      merges := merges + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('groups_found', groups, 'merges_executed', merges, 'dry_run', _dry_run);
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_merge_product_duplicates(boolean) TO authenticated;
