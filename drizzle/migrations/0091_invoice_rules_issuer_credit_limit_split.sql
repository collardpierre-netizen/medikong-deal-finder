ALTER TABLE public.vendor_invoice_payment_rules
  ADD COLUMN IF NOT EXISTS invoice_issuer text NOT NULL DEFAULT 'vendor'
    CHECK (invoice_issuer IN ('vendor','medikong')),
  ADD COLUMN IF NOT EXISTS credit_limit_cents integer NULL CHECK (credit_limit_cents IS NULL OR credit_limit_cents >= 0);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_deferred_incl_vat numeric NOT NULL DEFAULT 0;

ALTER TABLE public.sub_orders
  ADD COLUMN IF NOT EXISTS invoice_issuer text NULL;

DROP FUNCTION IF EXISTS public.resolve_invoice_payment_eligibility(uuid, uuid, integer);

CREATE FUNCTION public.resolve_invoice_payment_eligibility(_vendor_id uuid, _customer_id uuid, _amount_cents integer, _amount_incl_cents integer DEFAULT NULL)
 RETURNS TABLE(eligible boolean, net_days integer, rule_id uuid, reason text, invoice_issuer text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s record; c record; r record; outstanding bigint;
BEGIN
  SELECT * INTO s FROM public.vendor_invoice_payment_settings WHERE vendor_id = _vendor_id;
  IF s IS NULL OR s.enabled IS NOT TRUE THEN
    RETURN QUERY SELECT false, NULL::int, NULL::uuid, 'vendor_disabled'::text, NULL::text; RETURN;
  END IF;
  IF _amount_cents < COALESCE(s.min_order_amount_cents, 0) THEN
    RETURN QUERY SELECT false, NULL::int, NULL::uuid, 'below_min_order_amount'::text, NULL::text; RETURN;
  END IF;
  SELECT id, customer_type, country_code INTO c FROM public.customers WHERE id = _customer_id;
  IF c IS NULL THEN
    RETURN QUERY SELECT false, NULL::int, NULL::uuid, 'unknown_customer'::text, NULL::text; RETURN;
  END IF;

  FOR r IN
    SELECT * FROM public.vendor_invoice_payment_rules vr
    WHERE vr.vendor_id = _vendor_id AND vr.enabled = true
      AND _amount_cents >= COALESCE(vr.min_amount_cents, 0)
      AND (vr.customer_id IS NULL OR vr.customer_id = c.id)
      AND (vr.customer_type IS NULL OR vr.customer_type = c.customer_type)
      AND (vr.country_code IS NULL OR vr.country_code = c.country_code)
    ORDER BY vr.priority DESC, vr.created_at ASC
  LOOP
    IF r.credit_limit_cents IS NOT NULL THEN
      SELECT COALESCE(SUM(ROUND(so.subtotal_incl_vat * 100)), 0)::bigint INTO outstanding
      FROM public.sub_orders so JOIN public.orders o ON o.id = so.order_id
      WHERE so.vendor_id = _vendor_id AND o.customer_id = c.id
        AND so.payment_method = 'invoice' AND COALESCE(so.payment_status,'pending') <> 'paid'
        AND COALESCE(o.status::text,'') <> 'cancelled';
      IF outstanding + COALESCE(_amount_incl_cents, _amount_cents) > r.credit_limit_cents THEN
        RETURN QUERY SELECT false, NULL::int, r.id, 'credit_limit_exceeded'::text, NULL::text; RETURN;
      END IF;
    END IF;
    RETURN QUERY SELECT true, r.net_days, r.id, 'matched_rule'::text, r.invoice_issuer; RETURN;
  END LOOP;

  RETURN QUERY SELECT false, NULL::int, NULL::uuid, 'no_matching_rule'::text, NULL::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_invoice_payment_eligibility(uuid, uuid, integer, integer) TO authenticated, service_role;