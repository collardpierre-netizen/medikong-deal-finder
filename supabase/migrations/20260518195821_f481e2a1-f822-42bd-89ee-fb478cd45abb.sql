
CREATE OR REPLACE FUNCTION public.admin_bulk_map_labels_to_category(
  _labels text[],
  _category_id uuid,
  _source_locale text DEFAULT NULL
)
RETURNS TABLE(raw_label text, products_updated integer, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
  v_n integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _category_id IS NULL THEN
    RAISE EXCEPTION 'category_id required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = _category_id) THEN
    RAISE EXCEPTION 'Target category not found';
  END IF;

  FOREACH v_label IN ARRAY COALESCE(_labels, ARRAY[]::text[]) LOOP
    BEGIN
      v_label := NULLIF(trim(v_label), '');
      IF v_label IS NULL THEN
        CONTINUE;
      END IF;

      INSERT INTO public.category_source_aliases (source_path, source_locale, category_id, notes)
      VALUES (v_label, _source_locale, _category_id, 'auto:bulk-map')
      ON CONFLICT (source_path, COALESCE(source_locale, ''))
      DO UPDATE SET category_id = EXCLUDED.category_id, notes = 'auto:bulk-map';

      WITH upd AS (
        UPDATE public.products p
        SET primary_category_id = _category_id
        WHERE p.primary_category_id IS NULL
          AND COALESCE(NULLIF(trim(p.category_name), ''), NULLIF(trim(p.category), ''), '(vide)') = v_label
        RETURNING 1
      )
      SELECT count(*)::int INTO v_n FROM upd;

      raw_label := v_label;
      products_updated := v_n;
      error := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      raw_label := v_label;
      products_updated := 0;
      error := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_map_labels_to_category(text[], uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_map_labels_to_category(text[], uuid, text) TO authenticated;
