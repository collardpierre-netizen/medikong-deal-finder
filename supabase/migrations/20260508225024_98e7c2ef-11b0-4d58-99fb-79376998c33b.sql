CREATE TABLE IF NOT EXISTS public.home_showcase_events (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN ('impression','click')),
  product_id uuid NULL REFERENCES public.products(id) ON DELETE SET NULL,
  variant text NOT NULL CHECK (variant IN ('ok','no_offers','single_offer','fallback','not_found')),
  locale text NULL,
  country_code text NULL,
  session_id text NULL,
  user_id uuid NULL,
  delta_pct numeric NULL,
  offer_count integer NULL
);

CREATE INDEX IF NOT EXISTS idx_home_showcase_events_occurred_at
  ON public.home_showcase_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_home_showcase_events_product_kind
  ON public.home_showcase_events (product_id, kind, occurred_at DESC);

ALTER TABLE public.home_showcase_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_showcase_events_public_insert" ON public.home_showcase_events;
CREATE POLICY "home_showcase_events_public_insert"
ON public.home_showcase_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "home_showcase_events_admin_select" ON public.home_showcase_events;
CREATE POLICY "home_showcase_events_admin_select"
ON public.home_showcase_events
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_home_showcase_kpis(_days integer DEFAULT 30)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_slug text,
  variant text,
  impressions bigint,
  clicks bigint,
  ctr numeric,
  last_seen timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      e.product_id,
      e.variant,
      COUNT(*) FILTER (WHERE e.kind = 'impression') AS impressions,
      COUNT(*) FILTER (WHERE e.kind = 'click') AS clicks,
      MAX(e.occurred_at) AS last_seen
    FROM public.home_showcase_events e
    WHERE e.occurred_at >= now() - make_interval(days => GREATEST(_days, 1))
      AND public.is_admin(auth.uid())
    GROUP BY e.product_id, e.variant
  )
  SELECT
    a.product_id,
    p.name AS product_name,
    p.slug AS product_slug,
    a.variant,
    a.impressions,
    a.clicks,
    CASE WHEN a.impressions > 0
      THEN ROUND((a.clicks::numeric / a.impressions::numeric) * 100, 2)
      ELSE 0
    END AS ctr,
    a.last_seen
  FROM agg a
  LEFT JOIN public.products p ON p.id = a.product_id
  ORDER BY a.impressions DESC, a.clicks DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_home_showcase_kpis(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_home_showcase_kpis(integer) TO authenticated;