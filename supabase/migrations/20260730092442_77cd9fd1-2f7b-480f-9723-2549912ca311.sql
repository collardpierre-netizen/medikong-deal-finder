CREATE OR REPLACE FUNCTION public.select_price_history_backfill_targets(
  _limit integer DEFAULT 40,
  _fresh_hours integer DEFAULT 168,
  _include_rest boolean DEFAULT true
)
RETURNS TABLE (id uuid, gtin text, qogita_fid text, qogita_slug text, brand_priority integer, last_point date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.gtin, p.qogita_fid, p.qogita_slug,
         COALESCE(p.brand_priority, 0) AS brand_priority,
         h.last_point
  FROM public.products p
  LEFT JOIN LATERAL (
    SELECT max(price_date) AS last_point, max(scraped_at) AS last_scraped
    FROM public.qogita_price_history q
    WHERE q.gtin = p.gtin
  ) h ON true
  WHERE p.is_active = true
    AND p.gtin IS NOT NULL
    AND p.qogita_fid IS NOT NULL
    AND p.qogita_slug IS NOT NULL
    AND (h.last_scraped IS NULL OR h.last_scraped < now() - make_interval(hours => _fresh_hours))
    AND (_include_rest OR COALESCE(p.brand_priority, 0) > 0)
  ORDER BY COALESCE(p.brand_priority, 0) DESC,
           (h.last_point IS NOT NULL),
           h.last_point ASC NULLS FIRST,
           p.popularity DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(_limit, 200));
$$;

REVOKE ALL ON FUNCTION public.select_price_history_backfill_targets(integer, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_price_history_backfill_targets(integer, integer, boolean) TO service_role;