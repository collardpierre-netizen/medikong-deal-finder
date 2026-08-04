DROP POLICY IF EXISTS "Authenticated can read geocode cache" ON public.geocode_cache;
REVOKE SELECT ON public.geocode_cache FROM authenticated;
REVOKE SELECT ON public.geocode_cache FROM anon;
GRANT ALL ON public.geocode_cache TO service_role;