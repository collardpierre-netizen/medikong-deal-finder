DO $$
DECLARE
  v_target_cat uuid := '6d6b71a9-271c-44a6-99e0-d2cbfb5a98e2';
  v_aliases_deleted int := 0;
  v_products_reset int := 0;
  v_bad_pattern text :=
    '(serum|sérum|visage|soins du|soins de nuit|hydratation\s*-\s*nutrition|'
    || 'aveeno|crazy days|black friday|calendriers de|coffrets cadeaux|'
    || 'bonnes résolutions|aanbiedingen|protection visage|soins spécifiques|'
    || 'anti-cellulite|pigmentation|rougeurs|cheveux|solaires|bronzage|'
    || 'activateurs|anti-aging|anti-âge|anti-wrinkles|body moisturizing|'
    || 'body lotion|hydratation)';
BEGIN
  CREATE TEMP TABLE _bad_paths ON COMMIT DROP AS
  SELECT DISTINCT source_path
    FROM public.category_source_aliases
   WHERE category_id = v_target_cat
     AND source_path ~* v_bad_pattern;

  DELETE FROM public.category_source_aliases
   WHERE category_id = v_target_cat
     AND source_path IN (SELECT source_path FROM _bad_paths);
  GET DIAGNOSTICS v_aliases_deleted = ROW_COUNT;

  UPDATE public.products
     SET primary_category_id = NULL,
         manual_mapping_validated = false
   WHERE primary_category_id = v_target_cat
     AND category_name IN (SELECT source_path FROM _bad_paths)
     AND COALESCE(manual_mapping_validated, false) = false;
  GET DIAGNOSTICS v_products_reset = ROW_COUNT;

  RAISE NOTICE 'Complements & nutrition cleanup: % alias deleted, % products reset',
    v_aliases_deleted, v_products_reset;
END $$;