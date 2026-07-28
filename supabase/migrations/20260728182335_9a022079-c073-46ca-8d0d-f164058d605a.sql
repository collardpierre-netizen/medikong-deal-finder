-- Index to make the bounded priority lane cheap
CREATE INDEX IF NOT EXISTS idx_products_brand_priority_scrapable
  ON public.products (brand_priority DESC)
  WHERE brand_priority > 0 AND qogita_fid IS NOT NULL AND qogita_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offers_qogita_backed_lastverified
  ON public.offers (product_id, last_verified_at)
  WHERE is_qogita_backed = true AND is_active = true;

-- ── Priority lane target selection ────────────────────────────────
CREATE OR REPLACE FUNCTION public.select_priority_scrape_targets(
  _limit int DEFAULT 30,
  _fresh_hours int DEFAULT 48
)
RETURNS TABLE (product_id uuid, last_verified_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS product_id,
         MAX(o.last_verified_at) AS last_verified_at
  FROM public.products p
  JOIN public.offers o
    ON o.product_id = p.id
   AND o.is_qogita_backed = true
   AND o.is_active = true
  WHERE p.brand_priority > 0
    AND p.qogita_fid IS NOT NULL
    AND p.qogita_slug IS NOT NULL
  GROUP BY p.id
  HAVING MAX(o.last_verified_at) IS NULL
      OR MAX(o.last_verified_at) < (now() - make_interval(hours => GREATEST(_fresh_hours, 1)))
  ORDER BY MAX(o.last_verified_at) ASC NULLS FIRST
  LIMIT GREATEST(_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.select_priority_scrape_targets(int, int) TO service_role;

-- ── Overlap lock (TTL based, safe with pooled connections) ────────
CREATE TABLE IF NOT EXISTS public.scraper_locks (
  lock_key text PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  holder text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.scraper_locks TO service_role;
ALTER TABLE public.scraper_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read scraper locks"
  ON public.scraper_locks FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.acquire_scraper_lock(
  _key text,
  _ttl_seconds int DEFAULT 180,
  _holder text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _got boolean := false;
BEGIN
  DELETE FROM public.scraper_locks WHERE lock_key = _key AND expires_at < now();

  INSERT INTO public.scraper_locks (lock_key, locked_at, expires_at, holder, updated_at)
  VALUES (_key, now(), now() + make_interval(secs => GREATEST(_ttl_seconds, 10)), _holder, now())
  ON CONFLICT (lock_key) DO NOTHING;

  GET DIAGNOSTICS _got = ROW_COUNT;
  RETURN _got;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_scraper_lock(_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.scraper_locks WHERE lock_key = _key;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_scraper_lock(text, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_scraper_lock(text) TO service_role;

-- ── Freshness dashboard RPC (admin only) ──────────────────────────
CREATE OR REPLACE FUNCTION public.admin_priority_brands_freshness(_fresh_hours int DEFAULT 48)
RETURNS TABLE (
  brand_id uuid,
  brand_name text,
  is_priority int,
  products_total bigint,
  offers_total bigint,
  offers_fresh bigint,
  pct_fresh numeric,
  last_verified_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id AS brand_id,
         b.name AS brand_name,
         b.is_priority,
         COUNT(DISTINCT p.id) AS products_total,
         COUNT(o.id) AS offers_total,
         COUNT(o.id) FILTER (
           WHERE o.last_verified_at >= now() - make_interval(hours => GREATEST(_fresh_hours, 1))
         ) AS offers_fresh,
         ROUND(
           100.0 * COUNT(o.id) FILTER (
             WHERE o.last_verified_at >= now() - make_interval(hours => GREATEST(_fresh_hours, 1))
           ) / NULLIF(COUNT(o.id), 0), 2
         ) AS pct_fresh,
         MAX(o.last_verified_at) AS last_verified_at
  FROM public.brands b
  LEFT JOIN public.products p ON p.brand_id = b.id AND p.is_active = true
  LEFT JOIN public.offers o ON o.product_id = p.id AND o.is_qogita_backed = true AND o.is_active = true
  WHERE b.is_priority > 0
    AND public.is_admin()
  GROUP BY b.id, b.name, b.is_priority
  ORDER BY pct_fresh ASC NULLS FIRST, b.name;
$$;

GRANT EXECUTE ON FUNCTION public.admin_priority_brands_freshness(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_priority_brands_freshness(int) TO service_role;