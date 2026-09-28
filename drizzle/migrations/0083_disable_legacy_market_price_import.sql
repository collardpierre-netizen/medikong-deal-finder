REVOKE EXECUTE ON FUNCTION public.upsert_market_prices(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_import_wholesaler_prices(uuid, date, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_market_prices(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_import_wholesaler_prices(uuid, date, jsonb, text) TO service_role;
COMMENT ON FUNCTION public.upsert_market_prices(jsonb) IS 'DEPRECATED: ancien import sans contrôles, remplacé par admin_import_wholesaler_prices_v2 (page /admin/scan/imports)';
COMMENT ON FUNCTION public.admin_import_wholesaler_prices(uuid, date, jsonb, text) IS 'DEPRECATED: remplacé par admin_import_wholesaler_prices_v2';