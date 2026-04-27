CREATE OR REPLACE FUNCTION public.force_bulk_deactivate(
  _table_name text,
  _ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_user IS NULL OR NOT public.is_super_admin(v_user) THEN
    RAISE EXCEPTION 'Réservé aux super_admin' USING ERRCODE = '42501';
  END IF;

  IF _table_name NOT IN ('categories', 'products', 'offers') THEN
    RAISE EXCEPTION 'Table non autorisée : %', _table_name USING ERRCODE = '22023';
  END IF;

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('updated', 0);
  END IF;

  -- Active le flag d'override pour CETTE transaction
  PERFORM set_config('app.bulk_override', 'true', true);

  IF _table_name = 'categories' THEN
    UPDATE public.categories SET is_active = false
    WHERE id = ANY(_ids) AND is_active = true;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSIF _table_name = 'products' THEN
    UPDATE public.products SET is_active = false
    WHERE id = ANY(_ids) AND is_active = true;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSIF _table_name = 'offers' THEN
    UPDATE public.offers SET is_active = false
    WHERE id = ANY(_ids) AND is_active = true;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'updated', v_count,
    'table_name', _table_name,
    'forced', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.force_bulk_deactivate(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.force_bulk_deactivate(text, uuid[]) TO authenticated;