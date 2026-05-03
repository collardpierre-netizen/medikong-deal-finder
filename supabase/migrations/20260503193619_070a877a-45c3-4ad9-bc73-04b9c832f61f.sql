
CREATE TABLE IF NOT EXISTS public.catalog_health_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  country_code text NOT NULL,
  active_products_count integer NOT NULL DEFAULT 0,
  missing_offers_count integer NOT NULL DEFAULT 0,
  missing_ratio numeric(5,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_health_runs_country_run_at
  ON public.catalog_health_runs (country_code, run_at DESC);

CREATE TABLE IF NOT EXISTS public.catalog_health_missing_offers (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.catalog_health_runs(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  country_code text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_health_missing_offers_product
  ON public.catalog_health_missing_offers (product_id, country_code);
CREATE INDEX IF NOT EXISTS idx_catalog_health_missing_offers_run
  ON public.catalog_health_missing_offers (run_id);
CREATE INDEX IF NOT EXISTS idx_catalog_health_missing_offers_captured_at
  ON public.catalog_health_missing_offers (captured_at DESC);

ALTER TABLE public.catalog_health_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_health_missing_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view catalog health runs" ON public.catalog_health_runs;
CREATE POLICY "Admins can view catalog health runs"
  ON public.catalog_health_runs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view catalog health missing offers" ON public.catalog_health_missing_offers;
CREATE POLICY "Admins can view catalog health missing offers"
  ON public.catalog_health_missing_offers FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_active_products_without_offers()
RETURNS TABLE(country_code text, missing_offers_count integer, active_products_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _country text;
  _countries text[] := ARRAY['BE', 'FR', 'LU'];
  _run_id uuid;
  _active_count integer;
  _missing_count integer;
BEGIN
  FOREACH _country IN ARRAY _countries LOOP
    SELECT count(*) INTO _active_count FROM public.products p WHERE p.is_active = true;

    INSERT INTO public.catalog_health_runs (country_code, active_products_count, missing_offers_count, missing_ratio)
    VALUES (_country, _active_count, 0, 0)
    RETURNING id INTO _run_id;

    INSERT INTO public.catalog_health_missing_offers (run_id, product_id, country_code)
    SELECT _run_id, p.id, _country
    FROM public.products p
    WHERE p.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.offers o
        WHERE o.product_id = p.id
          AND o.is_active = true
          AND (o.country_code = _country OR o.country_code IS NULL)
      );

    GET DIAGNOSTICS _missing_count = ROW_COUNT;

    UPDATE public.catalog_health_runs
    SET missing_offers_count = _missing_count,
        missing_ratio = CASE WHEN _active_count > 0 THEN _missing_count::numeric / _active_count ELSE 0 END
    WHERE id = _run_id;

    country_code := _country;
    missing_offers_count := _missing_count;
    active_products_count := _active_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.log_active_products_without_offers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_active_products_without_offers() TO service_role;

CREATE OR REPLACE VIEW public.catalog_health_missing_offers_frequency_v
WITH (security_invoker = true) AS
SELECT
  m.product_id,
  m.country_code,
  count(DISTINCT m.run_id) AS missing_run_count,
  min(m.captured_at) AS first_seen_at,
  max(m.captured_at) AS last_seen_at,
  (SELECT count(*) FROM public.catalog_health_runs r
    WHERE r.country_code = m.country_code
      AND r.run_at >= now() - interval '30 days') AS total_runs_30d
FROM public.catalog_health_missing_offers m
WHERE m.captured_at >= now() - interval '30 days'
GROUP BY m.product_id, m.country_code;

GRANT SELECT ON public.catalog_health_missing_offers_frequency_v TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'log-active-products-without-offers-daily') THEN
      PERFORM cron.unschedule('log-active-products-without-offers-daily');
    END IF;
    PERFORM cron.schedule(
      'log-active-products-without-offers-daily',
      '30 2 * * *',
      $cron$ SELECT public.log_active_products_without_offers(); $cron$
    );
  END IF;
END $$;
