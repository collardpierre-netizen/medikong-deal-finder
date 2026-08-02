-- 1) Suivi des absences consécutives sur exports complets
CREATE TABLE IF NOT EXISTS public.qogita_product_absence (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  consecutive_missing_full integer NOT NULL DEFAULT 0,
  last_full_download_id uuid,
  last_missing_at timestamptz,
  last_present_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qogita_product_absence TO authenticated;
GRANT ALL ON public.qogita_product_absence TO service_role;

ALTER TABLE public.qogita_product_absence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_qogita_product_absence" ON public.qogita_product_absence;
CREATE POLICY "admins_read_qogita_product_absence"
  ON public.qogita_product_absence FOR SELECT TO authenticated
  USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_qogita_product_absence_updated_at ON public.qogita_product_absence;
CREATE TRIGGER trg_qogita_product_absence_updated_at
  BEFORE UPDATE ON public.qogita_product_absence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_qogita_product_absence_missing
  ON public.qogita_product_absence (consecutive_missing_full)
  WHERE consecutive_missing_full > 0;

-- 2) Normalisation GTIN (zéros non significatifs / caractères non numériques)
CREATE OR REPLACE FUNCTION public.normalize_gtin(_gtin text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(ltrim(regexp_replace(COALESCE(_gtin, ''), '\D', '', 'g'), '0'), '');
$$;

-- 3) Enregistrement de la présence après un export complet (idempotent par download)
CREATE OR REPLACE FUNCTION public.qogita_record_full_export_presence(_download_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _scope text;
  _rows bigint;
  _present bigint := 0;
  _missing bigint := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT scope, rows_total INTO _scope, _rows
  FROM public.qogita_catalog_downloads WHERE id = _download_id;

  IF _scope IS NULL THEN
    RAISE EXCEPTION 'download_not_found';
  END IF;
  IF _scope <> 'full' THEN
    RAISE EXCEPTION 'presence_requires_full_scope';
  END IF;
  IF COALESCE(_rows, 0) < 50000 THEN
    RAISE EXCEPTION 'full_catalog_too_small: %', _rows;
  END IF;

  CREATE TEMP TABLE _catalog_norm ON COMMIT DROP AS
  SELECT DISTINCT public.normalize_gtin(ci.gtin) AS ngtin
  FROM public.qogita_catalog_items ci
  WHERE ci.last_download_id = _download_id
    AND ci.is_present_in_catalog
    AND public.normalize_gtin(ci.gtin) IS NOT NULL;

  CREATE INDEX ON _catalog_norm (ngtin);

  CREATE TEMP TABLE _presence ON COMMIT DROP AS
  SELECT p.id AS product_id,
         EXISTS (SELECT 1 FROM _catalog_norm c WHERE c.ngtin = public.normalize_gtin(p.gtin)) AS present
  FROM public.products p
  WHERE p.source = 'qogita' AND p.gtin IS NOT NULL;

  -- Idempotence : on ne rejoue pas le même download deux fois
  INSERT INTO public.qogita_product_absence AS a
    (product_id, consecutive_missing_full, last_full_download_id, last_missing_at, last_present_at)
  SELECT pr.product_id,
         CASE WHEN pr.present THEN 0 ELSE 1 END,
         _download_id,
         CASE WHEN pr.present THEN NULL ELSE now() END,
         CASE WHEN pr.present THEN now() ELSE NULL END
  FROM _presence pr
  ON CONFLICT (product_id) DO UPDATE
    SET consecutive_missing_full = CASE
          WHEN a.last_full_download_id = _download_id THEN a.consecutive_missing_full
          WHEN EXCLUDED.consecutive_missing_full = 0 THEN 0
          ELSE a.consecutive_missing_full + 1
        END,
        last_full_download_id = _download_id,
        last_missing_at = CASE WHEN EXCLUDED.consecutive_missing_full = 0 THEN a.last_missing_at ELSE now() END,
        last_present_at = CASE WHEN EXCLUDED.consecutive_missing_full = 0 THEN now() ELSE a.last_present_at END;

  SELECT count(*) FILTER (WHERE present), count(*) FILTER (WHERE NOT present)
    INTO _present, _missing FROM _presence;

  RETURN jsonb_build_object(
    'download_id', _download_id,
    'products_present', _present,
    'products_missing', _missing
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qogita_record_full_export_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qogita_record_full_export_presence(uuid) TO authenticated, service_role;

-- 4) Désactivation durcie : 2 exports consécutifs + exclusion marques prioritaires
CREATE OR REPLACE FUNCTION public.qogita_deactivate_dead_products(
  _download_id uuid,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _scope text;
  _rows bigint;
  _catalog_gtins bigint;
  _absent_now bigint;
  _priority_excluded bigint;
  _not_yet_twice bigint;
  _dead bigint;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT scope, rows_total INTO _scope, _rows
  FROM public.qogita_catalog_downloads WHERE id = _download_id;

  IF _scope IS NULL THEN
    RAISE EXCEPTION 'download_not_found';
  END IF;
  IF _scope <> 'full' THEN
    RAISE EXCEPTION 'reconciliation_requires_full_scope';
  END IF;
  IF COALESCE(_rows, 0) < 50000 THEN
    RAISE EXCEPTION 'full_catalog_too_small: %', _rows;
  END IF;

  SELECT count(*) INTO _catalog_gtins
  FROM public.qogita_catalog_items
  WHERE last_download_id = _download_id AND is_present_in_catalog;

  CREATE TEMP TABLE _catalog_norm ON COMMIT DROP AS
  SELECT DISTINCT public.normalize_gtin(ci.gtin) AS ngtin
  FROM public.qogita_catalog_items ci
  WHERE ci.last_download_id = _download_id
    AND ci.is_present_in_catalog
    AND public.normalize_gtin(ci.gtin) IS NOT NULL;

  CREATE INDEX ON _catalog_norm (ngtin);

  -- Candidats : actifs, source qogita, absents du dernier export (GTIN normalisé)
  CREATE TEMP TABLE _absent ON COMMIT DROP AS
  SELECT p.id, COALESCE(p.brand_priority, 0) AS brand_priority
  FROM public.products p
  WHERE p.source = 'qogita'
    AND p.is_active
    AND p.gtin IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM _catalog_norm c WHERE c.ngtin = public.normalize_gtin(p.gtin)
    );

  SELECT count(*) INTO _absent_now FROM _absent;
  SELECT count(*) INTO _priority_excluded FROM _absent WHERE brand_priority > 0;

  -- Règle : absence confirmée sur 2 exports complets consécutifs
  CREATE TEMP TABLE _dead_products ON COMMIT DROP AS
  SELECT a.id
  FROM _absent a
  JOIN public.qogita_product_absence ab ON ab.product_id = a.id
  WHERE a.brand_priority = 0
    AND ab.consecutive_missing_full >= 2;

  SELECT count(*) INTO _dead FROM _dead_products;
  _not_yet_twice := _absent_now - _priority_excluded - _dead;

  IF COALESCE(_dead, 0) > 50000 THEN
    RAISE EXCEPTION 'safety_guard_too_many_dead: %', _dead;
  END IF;

  IF NOT _dry_run THEN
    UPDATE public.products p
       SET is_active = false, updated_at = now()
     WHERE p.id IN (SELECT id FROM _dead_products);

    UPDATE public.offers o
       SET is_active = false, updated_at = now()
     WHERE o.product_id IN (SELECT id FROM _dead_products)
       AND o.is_active;

    INSERT INTO public.sync_logs (sync_type, status, records_processed, metadata)
    VALUES ('qogita_catalog_reconcile', 'success', _dead,
            jsonb_build_object('download_id', _download_id,
                               'catalog_gtins', _catalog_gtins,
                               'absent_now', _absent_now,
                               'priority_excluded', _priority_excluded,
                               'not_yet_missing_twice', _not_yet_twice,
                               'deactivated_products', _dead));
  END IF;

  RETURN jsonb_build_object(
    'dry_run', _dry_run,
    'download_id', _download_id,
    'catalog_gtins', _catalog_gtins,
    'absent_from_last_full_export', _absent_now,
    'priority_brands_excluded', _priority_excluded,
    'not_yet_missing_twice', _not_yet_twice,
    'dead_products', _dead
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qogita_deactivate_dead_products(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qogita_deactivate_dead_products(uuid, boolean) TO authenticated, service_role;