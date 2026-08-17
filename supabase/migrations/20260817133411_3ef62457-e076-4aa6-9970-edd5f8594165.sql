CREATE OR REPLACE FUNCTION public.savings_monthly_breakdown(_group_key text DEFAULT NULL::text, _months integer DEFAULT 12)
RETURNS TABLE(month_start date, analyses_count integer, total_source numeric, total_medikong numeric, total_savings numeric, days jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH sims AS (
    SELECT s.id, s.created_at,
           coalesce(s.source_total_excl_vat, 0) AS src,
           coalesce(s.medikong_total_excl_vat, 0) AS mk,
           coalesce(s.savings_amount, 0) AS sav
    FROM public.savings_simulations s
    WHERE (
        public.is_admin(auth.uid())
        OR (s.user_id IS NOT NULL AND s.user_id = auth.uid())
        OR (s.email IS NOT NULL AND lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      )
      AND (_group_key IS NULL OR public.savings_group_key(s.pharmacy_name, s.email) = _group_key)
      AND s.created_at >= (date_trunc('month', now()) - make_interval(months => greatest(0, coalesce(_months, 12) - 1)))
  ), per_day AS (
    SELECT date_trunc('month', created_at)::date AS m,
           created_at::date AS d,
           count(*)::int AS c,
           sum(src) AS src, sum(mk) AS mk, sum(sav) AS sav
    FROM sims GROUP BY 1, 2
  )
  SELECT m,
         sum(c)::int,
         round(sum(src)::numeric, 2),
         round(sum(mk)::numeric, 2),
         round(sum(sav)::numeric, 2),
         jsonb_agg(jsonb_build_object('day', d, 'analyses', c, 'total_source', round(src::numeric, 2), 'total_savings', round(sav::numeric, 2)) ORDER BY d)
  FROM per_day
  GROUP BY m
  ORDER BY m;
$function$;

CREATE OR REPLACE FUNCTION public.savings_supplier_breakdown(_group_key text DEFAULT NULL::text)
RETURNS TABLE(supplier text, analyses_count integer, total_source numeric, total_savings numeric, pct_of_total numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH sims AS (
    SELECT coalesce(nullif(btrim(s.source_supplier), ''), 'other') AS sup,
           coalesce(s.source_total_excl_vat, 0) AS src,
           coalesce(s.savings_amount, 0) AS sav
    FROM public.savings_simulations s
    WHERE (
        public.is_admin(auth.uid())
        OR (s.user_id IS NOT NULL AND s.user_id = auth.uid())
        OR (s.email IS NOT NULL AND lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      )
      AND (_group_key IS NULL OR public.savings_group_key(s.pharmacy_name, s.email) = _group_key)
  ), tot AS (SELECT sum(src) AS t FROM sims)
  SELECT sup,
         count(*)::int,
         round(sum(src)::numeric, 2),
         round(sum(sav)::numeric, 2),
         CASE WHEN (SELECT t FROM tot) > 0 THEN round((sum(src) / (SELECT t FROM tot) * 100)::numeric, 1) ELSE 0 END
  FROM sims
  GROUP BY sup
  ORDER BY sum(src) DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.savings_monthly_breakdown(text, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.savings_supplier_breakdown(text) TO authenticated, anon;