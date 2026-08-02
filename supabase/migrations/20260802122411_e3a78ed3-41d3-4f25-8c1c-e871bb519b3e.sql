ALTER TABLE public.qogita_catalog_downloads
  ADD COLUMN IF NOT EXISTS download_url text,
  ADD COLUMN IF NOT EXISTS ingest_cursor bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ingest_rows bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ingest_state jsonb NOT NULL DEFAULT '{}'::jsonb;

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

  CREATE TEMP TABLE _dead_products ON COMMIT DROP AS
  SELECT p.id
  FROM public.products p
  WHERE p.source = 'qogita'
    AND p.is_active
    AND p.gtin IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.qogita_catalog_items ci
      WHERE ci.gtin = p.gtin
        AND ci.last_download_id = _download_id
        AND ci.is_present_in_catalog
    );

  SELECT count(*) INTO _dead FROM _dead_products;

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
                               'deactivated_products', _dead));
  END IF;

  RETURN jsonb_build_object(
    'dry_run', _dry_run,
    'download_id', _download_id,
    'catalog_gtins', _catalog_gtins,
    'dead_products', _dead
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qogita_deactivate_dead_products(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qogita_deactivate_dead_products(uuid, boolean) TO authenticated, service_role;