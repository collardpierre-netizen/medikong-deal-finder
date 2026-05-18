
-- Slug helper (idempotent)
CREATE OR REPLACE FUNCTION public.slugify_category_label(_label text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text;
BEGIN
  s := lower(coalesce(_label, ''));
  -- strip diacritics
  s := translate(s,
    'àáâäãåāçčćèéêëēėęìíîïīįñńòóôöõøōùúûüūýÿžźż',
    'aaaaaaacccceeeeeeeiiiiiinnoooooooouuuuuyyzzz');
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '(^-+|-+$)', '', 'g');
  IF s = '' THEN s := 'cat'; END IF;
  RETURN substring(s from 1 for 80);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_category_and_map(
  _raw_label text,
  _parent_id uuid,
  _name_fr text DEFAULT NULL,
  _name_nl text DEFAULT NULL,
  _name_en text DEFAULT NULL,
  _source_locale text DEFAULT NULL
)
RETURNS TABLE(category_id uuid, slug text, name text, products_updated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text := NULLIF(trim(_raw_label), '');
  v_parent_level smallint;
  v_max_order integer;
  v_slug_base text;
  v_slug text;
  v_name text;
  v_id uuid;
  v_existing_id uuid;
  v_n integer := 0;
  v_updated integer := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'raw_label required';
  END IF;
  IF _parent_id IS NULL THEN
    RAISE EXCEPTION 'parent_id required';
  END IF;

  SELECT level INTO v_parent_level FROM public.categories WHERE id = _parent_id;
  IF v_parent_level IS NULL THEN
    RAISE EXCEPTION 'Parent category not found';
  END IF;

  v_name := COALESCE(NULLIF(trim(_name_fr), ''), v_label);

  -- If alias already exists, reuse its category and just (re)map products.
  SELECT csa.category_id INTO v_existing_id
  FROM public.category_source_aliases csa
  WHERE csa.source_path = v_label
    AND COALESCE(csa.source_locale, '') = COALESCE(_source_locale, '')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    v_id := v_existing_id;
  ELSE
    -- Unique slug
    v_slug_base := public.slugify_category_label(v_name);
    v_slug := v_slug_base;
    WHILE EXISTS (SELECT 1 FROM public.categories WHERE slug = v_slug) LOOP
      v_n := v_n + 1;
      v_slug := v_slug_base || '-' || v_n::text;
    END LOOP;

    SELECT COALESCE(MAX(display_order), 0) + 10 INTO v_max_order
    FROM public.categories WHERE parent_id = _parent_id;

    INSERT INTO public.categories
      (name, slug, parent_id, level, display_order, is_active, status,
       name_fr, name_nl, name_en)
    VALUES
      (v_name, v_slug, _parent_id, (v_parent_level + 1)::smallint, v_max_order,
       true, 'active',
       COALESCE(NULLIF(trim(_name_fr), ''), v_name),
       NULLIF(trim(_name_nl), ''),
       NULLIF(trim(_name_en), ''))
    RETURNING id INTO v_id;

    INSERT INTO public.category_source_aliases (source_path, source_locale, category_id, notes)
    VALUES (v_label, _source_locale, v_id, 'auto:create-and-map')
    ON CONFLICT (source_path, COALESCE(source_locale, ''))
    DO UPDATE SET category_id = EXCLUDED.category_id, notes = 'auto:create-and-map';
  END IF;

  -- Backfill products
  WITH upd AS (
    UPDATE public.products p
    SET primary_category_id = v_id
    WHERE p.primary_category_id IS NULL
      AND COALESCE(NULLIF(trim(p.category_name), ''), NULLIF(trim(p.category), ''), '(vide)') = v_label
    RETURNING 1
  )
  SELECT count(*)::int INTO v_updated FROM upd;

  RETURN QUERY
    SELECT c.id, c.slug, c.name, v_updated
    FROM public.categories c WHERE c.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_category_and_map(text, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_category_and_map(text, uuid, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_bulk_create_categories_and_map(_payload jsonb)
RETURNS TABLE(raw_label text, category_id uuid, slug text, products_updated integer, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  r record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(_payload) LOOP
    BEGIN
      SELECT * INTO r FROM public.admin_create_category_and_map(
        (item->>'raw_label'),
        NULLIF(item->>'parent_id','')::uuid,
        NULLIF(item->>'name_fr',''),
        NULLIF(item->>'name_nl',''),
        NULLIF(item->>'name_en',''),
        NULLIF(item->>'source_locale','')
      );
      raw_label := item->>'raw_label';
      category_id := r.category_id;
      slug := r.slug;
      products_updated := r.products_updated;
      error := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      raw_label := item->>'raw_label';
      category_id := NULL; slug := NULL; products_updated := 0;
      error := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_create_categories_and_map(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_create_categories_and_map(jsonb) TO authenticated;
