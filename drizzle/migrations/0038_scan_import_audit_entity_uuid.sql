DO $$ BEGIN
  EXECUTE replace(pg_get_functiondef('public.admin_import_wholesaler_prices(uuid,date,jsonb,text)'::regprocedure),
    '_source_id::text,', '_source_id,');
END $$;