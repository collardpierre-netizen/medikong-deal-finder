-- Ensure unaccent extension exists in public schema
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- 1. Normalisation function
CREATE OR REPLACE FUNCTION public.normalize_brand_name(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        lower(public.unaccent(coalesce(_name, ''))),
        '\.(com|be|fr|nl|de|lu|net|eu|org|co|shop|store|io|app)\b',
        '',
        'g'
      ),
      '[^a-z0-9]+',
      '',
      'g'
    ),
    ''
  );
$$;

-- 2. Generated column on brands
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS norm_key text
    GENERATED ALWAYS AS (public.normalize_brand_name(name)) STORED;

CREATE INDEX IF NOT EXISTS idx_brands_norm_key ON public.brands(norm_key);

-- 3. Soft-warn trigger
CREATE OR REPLACE FUNCTION public.warn_brand_norm_duplicate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
BEGIN
  IF NEW.norm_key IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_existing
    FROM public.brands
    WHERE norm_key = NEW.norm_key
      AND id <> NEW.id
      AND is_active = true
    LIMIT 1;
  IF v_existing IS NOT NULL THEN
    INSERT INTO public.audit_logs(actor_id, module, action, target_type, target_id, payload)
    VALUES (
      NULL, 'brands', 'brand_duplicate_detected', 'brand', NEW.id,
      jsonb_build_object('new_name', NEW.name, 'norm_key', NEW.norm_key, 'existing_brand_id', v_existing)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warn_brand_norm_duplicate ON public.brands;
CREATE TRIGGER trg_warn_brand_norm_duplicate
  AFTER INSERT OR UPDATE OF name ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.warn_brand_norm_duplicate();

-- 4. Find duplicates
CREATE OR REPLACE FUNCTION public.find_brand_duplicates()
RETURNS TABLE(
  norm_key text,
  variant_count int,
  brand_ids uuid[],
  brand_names text[],
  product_counts int[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.norm_key,
    COUNT(*)::int AS variant_count,
    array_agg(b.id ORDER BY pc.cnt DESC NULLS LAST, b.created_at ASC) AS brand_ids,
    array_agg(b.name ORDER BY pc.cnt DESC NULLS LAST, b.created_at ASC) AS brand_names,
    array_agg(coalesce(pc.cnt, 0)::int ORDER BY pc.cnt DESC NULLS LAST, b.created_at ASC) AS product_counts
  FROM public.brands b
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt FROM public.products p WHERE p.brand_id = b.id
  ) pc ON true
  WHERE b.is_active = true AND b.norm_key IS NOT NULL
  GROUP BY b.norm_key
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC, b.norm_key;
$$;

REVOKE ALL ON FUNCTION public.find_brand_duplicates() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_brand_duplicates() TO authenticated;

-- 5. Merge brands
CREATE OR REPLACE FUNCTION public.merge_brands(_keep uuid, _drop uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep_name text;
  v_drop_name text;
  v_moved int := 0;
  v_actor uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(v_actor, 'super_admin') OR public.has_role(v_actor, 'admin')) THEN
    RAISE EXCEPTION 'forbidden: admin required';
  END IF;
  IF _keep = _drop THEN
    RAISE EXCEPTION 'keep and drop must differ';
  END IF;

  SELECT name INTO v_keep_name FROM public.brands WHERE id = _keep;
  SELECT name INTO v_drop_name FROM public.brands WHERE id = _drop;
  IF v_keep_name IS NULL OR v_drop_name IS NULL THEN
    RAISE EXCEPTION 'brand not found';
  END IF;

  UPDATE public.products
     SET brand_id = _keep,
         brand_name = v_keep_name
   WHERE brand_id = _drop;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  UPDATE public.products
     SET brand_name = v_keep_name
   WHERE brand_id = _keep AND brand_name IS DISTINCT FROM v_keep_name;

  DELETE FROM public.brands WHERE id = _drop;

  INSERT INTO public.audit_logs(actor_id, module, action, target_type, target_id, payload)
  VALUES (
    v_actor, 'brands', 'brand_merge', 'brand', _keep,
    jsonb_build_object(
      'kept_id', _keep, 'kept_name', v_keep_name,
      'dropped_id', _drop, 'dropped_name', v_drop_name,
      'products_reassigned', v_moved
    )
  );

  RETURN jsonb_build_object('kept_id', _keep, 'dropped_id', _drop, 'products_reassigned', v_moved);
END;
$$;

REVOKE ALL ON FUNCTION public.merge_brands(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_brands(uuid, uuid) TO authenticated;

-- 6. Auto-merge legacy duplicates
CREATE OR REPLACE FUNCTION public.auto_merge_brand_duplicates(_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_groups int := 0;
  v_merges int := 0;
  v_products int := 0;
  rec record;
  i int;
  v_res jsonb;
  v_log jsonb := '[]'::jsonb;
BEGIN
  IF NOT (public.has_role(v_actor, 'super_admin') OR public.has_role(v_actor, 'admin')) THEN
    RAISE EXCEPTION 'forbidden: admin required';
  END IF;

  FOR rec IN SELECT * FROM public.find_brand_duplicates() LOOP
    v_groups := v_groups + 1;
    FOR i IN 2 .. array_length(rec.brand_ids, 1) LOOP
      IF _dry_run THEN
        v_log := v_log || jsonb_build_object(
          'keep', rec.brand_names[1], 'drop', rec.brand_names[i],
          'norm_key', rec.norm_key, 'products', rec.product_counts[i]
        );
      ELSE
        v_res := public.merge_brands(rec.brand_ids[1], rec.brand_ids[i]);
        v_merges := v_merges + 1;
        v_products := v_products + coalesce((v_res->>'products_reassigned')::int, 0);
        v_log := v_log || (v_res || jsonb_build_object(
          'keep_name', rec.brand_names[1], 'drop_name', rec.brand_names[i]
        ));
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', _dry_run,
    'groups_found', v_groups,
    'merges_executed', v_merges,
    'products_reassigned', v_products,
    'details', v_log
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auto_merge_brand_duplicates(boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_merge_brand_duplicates(boolean) TO authenticated;