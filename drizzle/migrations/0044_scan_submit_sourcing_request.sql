CREATE OR REPLACE FUNCTION public.scan_submit_sourcing_request(
  _scan_event_id uuid,
  _monthly_qty integer DEFAULT NULL,
  _current_price numeric DEFAULT NULL,
  _current_supplier text DEFAULT NULL,
  _photo_path text DEFAULT NULL,
  _name text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ev record;
  _cust record;
  _item_id uuid;
  _key text;
  _email text;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _monthly_qty IS NOT NULL AND _monthly_qty < 0 THEN RAISE EXCEPTION 'invalid_quantity'; END IF;
  IF _current_price IS NOT NULL AND _current_price < 0 THEN RAISE EXCEPTION 'invalid_price'; END IF;

  SELECT * INTO _ev FROM scan_events WHERE id = _scan_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'scan_not_found'; END IF;

  IF NOT (_ev.customer_id IN (
      SELECT c.id FROM customers c WHERE c.auth_user_id = _uid
      UNION SELECT x FROM current_user_buyer_account_ids() x)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, company_name, email, scan_enabled INTO _cust FROM customers WHERE id = _ev.customer_id;
  IF NOT coalesce(_cust.scan_enabled, false)
     OR NOT coalesce((SELECT scan_enabled FROM site_config WHERE id = 1), false) THEN
    RAISE EXCEPTION 'scan_disabled';
  END IF;

  IF _photo_path IS NOT NULL AND left(_photo_path, length(_cust.id::text) + 1) <> _cust.id::text || '/' THEN
    RAISE EXCEPTION 'invalid_photo_path';
  END IF;

  _key := CASE
    WHEN _ev.product_id IS NOT NULL THEN _ev.product_id::text
    WHEN _ev.gtin IS NOT NULL THEN 'gtin:' || _ev.gtin
    WHEN _ev.cnk IS NOT NULL THEN 'cnk:' || _ev.cnk
  END;
  IF _key IS NOT NULL THEN
    SELECT id INTO _item_id FROM buyer_comparator_sourcing_items WHERE dedupe_key = _key LIMIT 1;
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  INSERT INTO sourcing_requests (
    request_number, customer_id, contact_name, contact_email, product_description,
    gtin, cnk_code, source, monthly_quantity, current_price_excl_vat, current_supplier,
    photo_path, sourcing_item_id, scan_event_id
  ) VALUES (
    'SCAN-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    _cust.id, coalesce(_cust.company_name, 'Officine'), coalesce(_email, _cust.email, ''),
    coalesce(nullif(btrim(_name), ''), (SELECT name FROM products WHERE id = _ev.product_id), coalesce(_ev.gtin, _ev.cnk, 'Produit scanné')),
    _ev.gtin, _ev.cnk, 'scan', _monthly_qty, _current_price, nullif(btrim(_current_supplier), ''),
    _photo_path, _item_id, _ev.id
  ) RETURNING id INTO _id;

  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.scan_submit_sourcing_request(uuid, integer, numeric, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.scan_submit_sourcing_request(uuid, integer, numeric, text, text, text) TO authenticated;