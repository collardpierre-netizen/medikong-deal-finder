DO $$ BEGIN
  EXECUTE replace(pg_get_functiondef('public.admin_import_wholesaler_prices(uuid,date,jsonb,text)'::regprocedure),
  $r$INSERT INTO audit_logs (action, entity_type, details)
  SELECT 'wholesaler_prices_import', 'market_price_sources',
    jsonb_build_object('source_id', _source_id, 'period', v_period, 'file', _source_file, 'rows', n_rows, 'matched', n_matched)
  WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='details');$r$,
  $r$INSERT INTO audit_logs (action, user_id, module, entity_type, entity_id, metadata)
  VALUES ('wholesaler_prices_import', auth.uid(), 'scan', 'market_price_sources', _source_id::text,
    jsonb_build_object('period', v_period, 'file', _source_file, 'rows', n_rows, 'matched', n_matched));$r$);
END $$;