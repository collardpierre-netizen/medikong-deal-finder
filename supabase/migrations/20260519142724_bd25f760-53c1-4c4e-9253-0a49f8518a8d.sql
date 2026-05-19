CREATE MATERIALIZED VIEW IF NOT EXISTS public.vendor_top_brands_mv AS
SELECT
  o.vendor_id,
  b.id          AS brand_id,
  b.name        AS brand_name,
  b.slug        AS brand_slug,
  b.logo_url    AS brand_logo_url,
  COUNT(*)::int AS offer_count
FROM public.offers o
JOIN public.products p ON p.id = o.product_id
JOIN public.brands   b ON b.id = p.brand_id
WHERE o.is_active = true
  AND b.is_active = true
GROUP BY o.vendor_id, b.id, b.name, b.slug, b.logo_url;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_top_brands_mv_pk
  ON public.vendor_top_brands_mv (vendor_id, brand_id);

CREATE INDEX IF NOT EXISTS vendor_top_brands_mv_vendor_count_idx
  ON public.vendor_top_brands_mv (vendor_id, offer_count DESC);

CREATE OR REPLACE FUNCTION public.vendor_top_brands(
  _vendor_id uuid,
  _limit     int DEFAULT 12
)
RETURNS TABLE (
  brand_id        uuid,
  brand_name      text,
  brand_slug      text,
  brand_logo_url  text,
  offer_count     int
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT brand_id, brand_name, brand_slug, brand_logo_url, offer_count
  FROM public.vendor_top_brands_mv
  WHERE vendor_id = _vendor_id
  ORDER BY offer_count DESC, brand_name ASC
  LIMIT GREATEST(COALESCE(_limit, 12), 1);
$$;

GRANT EXECUTE ON FUNCTION public.vendor_top_brands(uuid, int) TO anon, authenticated;
GRANT SELECT ON public.vendor_top_brands_mv TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_vendor_top_brands_mv_with_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id  uuid;
  v_started timestamptz := now();
  v_rows    int;
BEGIN
  INSERT INTO public.sync_logs (sync_type, started_at, status)
  VALUES ('vendor_top_brands_mv'::public.sync_type_enum, v_started, 'running'::public.sync_log_status)
  RETURNING id INTO v_log_id;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_top_brands_mv;
    SELECT COUNT(*)::int INTO v_rows FROM public.vendor_top_brands_mv;

    UPDATE public.sync_logs
       SET status = 'completed'::public.sync_log_status,
           completed_at = now(),
           stats = jsonb_build_object(
             'rows', v_rows,
             'duration_ms', EXTRACT(EPOCH FROM (now() - v_started)) * 1000
           )
     WHERE id = v_log_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.sync_logs
       SET status = 'error'::public.sync_log_status,
           completed_at = now(),
           error_message = SQLERRM
     WHERE id = v_log_id;
    RAISE;
  END;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-vendor-top-brands-mv-daily') THEN
    PERFORM cron.unschedule('refresh-vendor-top-brands-mv-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-vendor-top-brands-mv-daily',
  '30 3 * * *',
  $$ SELECT public.refresh_vendor_top_brands_mv_with_log(); $$
);

REFRESH MATERIALIZED VIEW public.vendor_top_brands_mv;
SELECT public.refresh_vendor_top_brands_mv_with_log();