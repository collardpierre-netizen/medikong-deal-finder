CREATE OR REPLACE FUNCTION public.admin_finish_wholesaler_import(_import_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE imp market_price_imports%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE market_price_imports SET status = CASE WHEN rows_count = 0 THEN 'empty' ELSE 'done' END
    WHERE id = _import_id AND status = 'running' RETURNING * INTO imp;
  IF FOUND THEN
    INSERT INTO audit_logs (action, user_id, module, entity_type, entity_id, metadata)
    VALUES ('wholesaler_prices_import', auth.uid(), 'scan', 'market_price_sources', imp.source_id,
      jsonb_build_object('import_id', imp.id, 'tariff_date', imp.tariff_date, 'file', imp.file_name,
        'rows', imp.rows_count, 'changed', imp.changed_count, 'inserted', imp.inserted_count, 'status', imp.status));
  END IF;
END $function$;