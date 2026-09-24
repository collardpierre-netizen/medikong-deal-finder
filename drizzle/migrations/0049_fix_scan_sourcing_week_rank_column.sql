CREATE OR REPLACE FUNCTION public.scan_sourcing_week_rank(_scan_event_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ev record;
  _n integer;
BEGIN
  SELECT * INTO _ev FROM scan_events WHERE id = _scan_event_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT (_ev.customer_id IN (
      SELECT c.id FROM customers c WHERE c.auth_user_id = auth.uid()
      UNION SELECT x FROM current_user_buyer_account_ids() x)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(DISTINCT e.customer_id) INTO _n
  FROM scan_events e
  JOIN customers c ON c.id = e.customer_id
  WHERE e.scanned_at >= now() - interval '7 days'
    AND (coalesce(c.is_test, false) = false OR e.customer_id = _ev.customer_id)
    AND (
      (_ev.product_id IS NOT NULL AND e.product_id = _ev.product_id)
      OR (_ev.product_id IS NULL AND _ev.gtin IS NOT NULL AND e.gtin = _ev.gtin)
      OR (_ev.product_id IS NULL AND _ev.gtin IS NULL AND _ev.cnk IS NOT NULL AND e.cnk = _ev.cnk)
    );
  RETURN greatest(coalesce(_n, 1), 1);
END $function$;