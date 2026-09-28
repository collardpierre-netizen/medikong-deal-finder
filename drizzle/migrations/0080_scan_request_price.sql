CREATE OR REPLACE FUNCTION public.scan_request_price(_scan_event_id uuid, _product_id uuid, _target_price_excl_vat numeric, _quantity integer DEFAULT NULL, _reference_supplier text DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid(); _ev record; _cust record; _item_id uuid; _email text; _id uuid; _pname text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _target_price_excl_vat IS NULL OR _target_price_excl_vat <= 0 OR _target_price_excl_vat > 100000 THEN RAISE EXCEPTION 'invalid_price'; END IF;
  IF _quantity IS NOT NULL AND (_quantity < 1 OR _quantity > 100000) THEN RAISE EXCEPTION 'invalid_quantity'; END IF;
  SELECT * INTO _ev FROM scan_events WHERE id = _scan_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'scan_not_found'; END IF;
  IF _ev.product_id IS DISTINCT FROM _product_id THEN RAISE EXCEPTION 'product_mismatch'; END IF;
  IF NOT (_ev.customer_id IN (SELECT c.id FROM customers c WHERE c.auth_user_id = _uid UNION SELECT x FROM current_user_buyer_account_ids() x)) THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id, company_name, email, scan_enabled INTO _cust FROM customers WHERE id = _ev.customer_id;
  IF NOT coalesce(_cust.scan_enabled, false) OR NOT coalesce((SELECT scan_enabled FROM site_config WHERE id = 1), false) THEN
    RAISE EXCEPTION 'scan_disabled'; END IF;
  SELECT id INTO _id FROM sourcing_requests WHERE scan_event_id = _ev.id AND source = 'scan' AND budget_max IS NOT NULL LIMIT 1;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT id INTO _item_id FROM buyer_comparator_sourcing_items WHERE dedupe_key = _product_id::text LIMIT 1;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  SELECT name INTO _pname FROM products WHERE id = _product_id;
  INSERT INTO sourcing_requests (request_number, customer_id, contact_name, contact_email, product_description,
    gtin, cnk_code, source, quantity_needed, budget_max, current_price_excl_vat, current_supplier, sourcing_item_id, scan_event_id, admin_notes)
  VALUES ('SCAN-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    _cust.id, coalesce(_cust.company_name, 'Officine'), coalesce(_email, _cust.email, ''), coalesce(_pname, 'Produit scanné'),
    _ev.gtin, _ev.cnk, 'scan', _quantity, round(_target_price_excl_vat, 2), round(_target_price_excl_vat, 2),
    nullif(btrim(left(coalesce(_reference_supplier, ''), 120)), ''), _item_id, _ev.id,
    'Demande de prix depuis le verdict Scan (MediKong plus cher). Prix cible = meilleur prix de l''officine.')
  RETURNING id INTO _id;
  RETURN _id;
END $function$;
REVOKE ALL ON FUNCTION public.scan_request_price(uuid, uuid, numeric, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_request_price(uuid, uuid, numeric, integer, text) TO authenticated;