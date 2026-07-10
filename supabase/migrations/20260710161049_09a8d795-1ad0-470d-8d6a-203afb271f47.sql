
-- RPC : liste des alias catégorie source, enrichie avec la cible et les compteurs
-- de produits qui matcheraient le libellé (permet la validation dry-run avant apply).
CREATE OR REPLACE FUNCTION public.admin_category_source_aliases_list(
  _search text DEFAULT NULL,
  _locale text DEFAULT NULL,
  _only_unmapped_products boolean DEFAULT false,
  _limit int DEFAULT 500
)
RETURNS TABLE (
  id uuid,
  source_path text,
  source_locale text,
  category_id uuid,
  category_slug text,
  category_name text,
  category_is_active boolean,
  notes text,
  created_at timestamptz,
  pending_products bigint,
  total_products bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  RETURN QUERY
  WITH counts AS (
    SELECT
      p.category_name AS raw_label,
      COUNT(*) FILTER (WHERE p.is_active) AS total_products,
      COUNT(*) FILTER (WHERE p.is_active AND p.primary_category_id IS NULL) AS pending_products
    FROM public.products p
    WHERE p.category_name IS NOT NULL
    GROUP BY p.category_name
  )
  SELECT
    a.id,
    a.source_path,
    a.source_locale,
    a.category_id,
    c.slug,
    c.name,
    c.is_active,
    a.notes,
    a.created_at,
    COALESCE(ct.pending_products, 0),
    COALESCE(ct.total_products, 0)
  FROM public.category_source_aliases a
  LEFT JOIN public.categories c ON c.id = a.category_id
  LEFT JOIN counts ct ON ct.raw_label = a.source_path
  WHERE (_search IS NULL OR _search = '' OR a.source_path ILIKE '%' || _search || '%'
         OR c.name ILIKE '%' || _search || '%' OR c.slug ILIKE '%' || _search || '%')
    AND (_locale IS NULL OR _locale = '' OR COALESCE(a.source_locale, '') = _locale)
    AND (NOT _only_unmapped_products OR COALESCE(ct.pending_products, 0) > 0)
  ORDER BY COALESCE(ct.pending_products, 0) DESC, a.source_path ASC
  LIMIT GREATEST(_limit, 1);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_category_source_aliases_list(text, text, boolean, int) TO authenticated;

-- Upsert d'un alias (create/update).
CREATE OR REPLACE FUNCTION public.admin_upsert_category_source_alias(
  _id uuid,
  _source_path text,
  _source_locale text,
  _category_id uuid,
  _notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  IF _source_path IS NULL OR trim(_source_path) = '' THEN
    RAISE EXCEPTION 'source_path required';
  END IF;
  IF _category_id IS NULL THEN
    RAISE EXCEPTION 'category_id required';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.category_source_aliases (source_path, source_locale, category_id, notes)
    VALUES (trim(_source_path), NULLIF(trim(COALESCE(_source_locale, '')), ''), _category_id, NULLIF(trim(COALESCE(_notes, '')), ''))
    ON CONFLICT (source_path, COALESCE(source_locale, ''))
    DO UPDATE SET category_id = EXCLUDED.category_id, notes = EXCLUDED.notes
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.category_source_aliases
       SET source_path = trim(_source_path),
           source_locale = NULLIF(trim(COALESCE(_source_locale, '')), ''),
           category_id = _category_id,
           notes = NULLIF(trim(COALESCE(_notes, '')), '')
     WHERE id = _id
     RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_category_source_alias(uuid, text, text, uuid, text) TO authenticated;

-- Suppression d'un alias.
CREATE OR REPLACE FUNCTION public.admin_delete_category_source_alias(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  DELETE FROM public.category_source_aliases WHERE id = _id;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_delete_category_source_alias(uuid) TO authenticated;

-- Dry-run : compte les produits qui seraient rattachés si on appliquait apply_category_aliases MAINTENANT
-- (produits actifs sans primary_category_id dont category_name matche un alias avec target).
CREATE OR REPLACE FUNCTION public.admin_preview_apply_category_aliases()
RETURNS TABLE (
  total_pending_products bigint,
  matching_aliases bigint,
  would_update_products bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.products WHERE is_active AND primary_category_id IS NULL) AS total_pending_products,
    (SELECT COUNT(DISTINCT a.id)
       FROM public.category_source_aliases a
       JOIN public.products p ON p.category_name = a.source_path
      WHERE a.category_id IS NOT NULL
        AND p.is_active
        AND p.primary_category_id IS NULL) AS matching_aliases,
    (SELECT COUNT(*)
       FROM public.products p
       JOIN public.category_source_aliases a ON a.source_path = p.category_name
      WHERE a.category_id IS NOT NULL
        AND p.is_active
        AND p.primary_category_id IS NULL) AS would_update_products;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_preview_apply_category_aliases() TO authenticated;
