REVOKE ALL ON public.admin_price_cockpit_mv FROM anon, authenticated;
GRANT SELECT ON public.admin_price_cockpit_mv TO service_role;