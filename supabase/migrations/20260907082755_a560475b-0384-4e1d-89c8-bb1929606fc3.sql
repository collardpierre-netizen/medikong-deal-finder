ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS anonymize_vendors boolean NOT NULL DEFAULT false;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS anonymize_vendor boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_quote_by_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_lines jsonb;
  v_customer jsonb;
  v_vendor jsonb;
BEGIN
  SELECT * INTO v_quote FROM public.quotes
  WHERE public_token = _token AND public_token IS NOT NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_quote.token_expires_at IS NOT NULL AND v_quote.token_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  IF v_quote.viewed_at IS NULL AND v_quote.status = 'sent' THEN
    UPDATE public.quotes SET viewed_at = now() WHERE id = v_quote.id;
    v_quote.viewed_at := now();
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', ql.id,
    'product_id', ql.product_id,
    'label', ql.label,
    'qty', ql.qty,
    'unit_price_ht_cents', ql.unit_price_ht_cents,
    'vat_rate', ql.vat_rate,
    'total_ht_cents', ql.total_ht_cents,
    'total_ttc_cents', ql.total_ttc_cents
  ) ORDER BY ql.sort_order, ql.created_at)
  INTO v_lines
  FROM public.quote_lines ql
  WHERE ql.quote_id = v_quote.id;

  SELECT jsonb_build_object(
    'company_name', c.company_name,
    'email', c.email,
    'country_code', c.country_code,
    'address_line1', c.address_line1,
    'city', c.city,
    'postal_code', c.postal_code,
    'vat_number', c.vat_number
  ) INTO v_customer
  FROM public.customers c WHERE c.id = v_quote.customer_id;

  IF coalesce(v_quote.anonymize_vendor, false) THEN
    SELECT jsonb_build_object(
      'name', 'Fournisseur ' || coalesce(v.display_code, 'MediKong'),
      'company_name', 'Fournisseur ' || coalesce(v.display_code, 'MediKong'),
      'logo_url', NULL
    ) INTO v_vendor
    FROM public.vendors v WHERE v.id = v_quote.vendor_id;
  ELSE
    SELECT jsonb_build_object(
      'name', v.name,
      'company_name', v.company_name,
      'logo_url', v.logo_url
    ) INTO v_vendor
    FROM public.vendors v WHERE v.id = v_quote.vendor_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_quote.id,
    'quote_number', v_quote.quote_number,
    'status', v_quote.status,
    'payment_method', v_quote.payment_method,
    'sent_at', v_quote.sent_at,
    'accepted_at', v_quote.accepted_at,
    'declined_at', v_quote.declined_at,
    'paid_at', v_quote.paid_at,
    'total_ht_cents', v_quote.total_ht_cents,
    'total_tva_cents', v_quote.total_tva_cents,
    'total_ttc_cents', v_quote.total_ttc_cents,
    'currency_code', v_quote.currency_code,
    'notes_customer', v_quote.notes_customer,
    'pdf_storage_path', v_quote.pdf_storage_path,
    'anonymize_vendor', coalesce(v_quote.anonymize_vendor, false),
    'lines', COALESCE(v_lines, '[]'::jsonb),
    'customer', v_customer,
    'vendor', v_vendor
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.public_get_order_by_token(_token text, _pin text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_customer jsonb;
  v_lines jsonb;
  v_vendor_bank jsonb;
  v_subtotal numeric;
  v_vat numeric;
  v_total numeric;
  v_anon boolean;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_order.public_access_expires_at IS NOT NULL AND v_order.public_access_expires_at < now() THEN
    RETURN jsonb_build_object('expired', true);
  END IF;

  IF v_order.public_access_pin IS NOT NULL AND length(v_order.public_access_pin) > 0 THEN
    IF _pin IS NULL OR length(_pin) = 0 THEN
      RETURN jsonb_build_object('requires_pin', true);
    ELSIF _pin <> v_order.public_access_pin THEN
      RETURN jsonb_build_object('requires_pin', true, 'invalid_pin', true);
    END IF;
  END IF;

  v_anon := coalesce(v_order.anonymize_vendors, false);

  v_subtotal := coalesce(v_order.subtotal_excl_vat, 0);
  v_vat      := coalesce(v_order.vat_amount, 0);
  v_total    := coalesce(v_order.total_incl_vat, 0);

  SELECT to_jsonb(c) - 'created_at' - 'updated_at'
    INTO v_customer FROM public.customers c WHERE c.id = v_order.customer_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ol.id,
    'quantity', ol.quantity,
    'quantity_shipped', ol.quantity_shipped,
    'unit_price_excl_vat', ol.unit_price_excl_vat,
    'vat_rate', ol.vat_rate,
    'line_total_excl_vat', ol.line_total_excl_vat,
    'manual_label', coalesce(ol.manual_label, p.name),
    'product_name', p.name,
    'product_gtin', p.gtin,
    'product_cnk', p.cnk_code,
    'fulfillment_status', ol.fulfillment_status,
    'tracking_number', ol.tracking_number,
    'tracking_url', ol.tracking_url,
    'vendor_name', CASE WHEN v_anon
      THEN 'Fournisseur ' || coalesce(v.display_code, 'MediKong')
      ELSE coalesce(v.company_name, v.name) END
  ) ORDER BY ol.id), '[]'::jsonb)
  INTO v_lines
  FROM public.order_lines ol
  LEFT JOIN public.products p ON p.id = ol.product_id
  LEFT JOIN public.vendors v ON v.id = ol.vendor_id
  WHERE ol.order_id = v_order.id;

  IF (v_lines IS NULL OR v_lines = '[]'::jsonb)
     AND v_order.draft_payload IS NOT NULL
     AND jsonb_typeof(v_order.draft_payload->'lines') = 'array' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', t.rn::text,
      'manual_label', coalesce(t.l->>'manual_label', t.l->>'offer_label', t.p_name),
      'product_name', t.p_name,
      'product_gtin', t.p_gtin,
      'product_cnk', t.p_cnk,
      'quantity', t.qty,
      'unit_price_excl_vat', t.unit_price,
      'vat_rate', t.vat_rate,
      'line_total_excl_vat', t.line_ht,
      'vendor_name', t.vendor_name
    ) ORDER BY t.rn), '[]'::jsonb)
    INTO v_lines
    FROM (
      SELECT row_number() OVER () AS rn,
             l,
             p.name AS p_name,
             p.gtin AS p_gtin,
             p.cnk_code AS p_cnk,
             CASE WHEN v_anon
               THEN 'Fournisseur ' || coalesce(v.display_code, 'MediKong')
               ELSE coalesce(v.company_name, v.name) END AS vendor_name,
             coalesce(nullif(l->>'quantity','')::numeric, 0) AS qty,
             coalesce(nullif(l->>'unit_price_excl_vat','')::numeric, 0) AS unit_price,
             coalesce(nullif(l->>'vat_rate','')::numeric, 0) AS vat_rate,
             coalesce(nullif(l->>'line_total_excl_vat','')::numeric,
                      coalesce(nullif(l->>'quantity','')::numeric, 0)
                      * coalesce(nullif(l->>'unit_price_excl_vat','')::numeric, 0)) AS line_ht
      FROM jsonb_array_elements(v_order.draft_payload->'lines') l
      LEFT JOIN public.products p ON p.id = nullif(l->>'product_id','')::uuid
      LEFT JOIN public.vendors v ON v.id = nullif(l->>'vendor_id','')::uuid
    ) t;

    SELECT coalesce(sum(t.line_ht), 0),
           coalesce(sum(t.line_ht * t.vat_rate / 100), 0)
      INTO v_subtotal, v_vat
    FROM (
      SELECT coalesce(nullif(l->>'line_total_excl_vat','')::numeric,
                      coalesce(nullif(l->>'quantity','')::numeric, 0)
                      * coalesce(nullif(l->>'unit_price_excl_vat','')::numeric, 0)) AS line_ht,
             coalesce(nullif(l->>'vat_rate','')::numeric, 0) AS vat_rate
      FROM jsonb_array_elements(v_order.draft_payload->'lines') l
    ) t;
    v_total := v_subtotal + v_vat;
  END IF;

  IF coalesce(v_order.show_payment_info, true) AND NOT v_anon THEN
    SELECT to_jsonb(v) - 'created_at' - 'updated_at' - 'auth_user_id' - 'email'
      INTO v_vendor_bank
      FROM public.vendors v
      JOIN public.order_lines ol ON ol.vendor_id = v.id
      WHERE ol.order_id = v_order.id AND (v.iban IS NOT NULL OR v.bank_name IS NOT NULL)
      LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'subtotal_excl_vat', v_subtotal,
    'vat_amount', v_vat,
    'total_incl_vat', v_total,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'payment_due_date', v_order.payment_due_date,
    'notes', v_order.notes,
    'is_forecast', v_order.is_forecast,
    'fulfillment_mode', v_order.fulfillment_mode,
    'shipping_address', v_order.shipping_address,
    'anonymize_vendors', v_anon,
    'customer', v_customer,
    'lines', v_lines,
    'vendor_bank', v_vendor_bank,
    'public_access_expires_at', v_order.public_access_expires_at,
    'customer_validated_at', v_order.customer_validated_at,
    'customer_validation_email', v_order.customer_validation_email,
    'tracking_url', v_order.tracking_url,
    'tracking_carrier', v_order.tracking_carrier,
    'tracking_number', v_order.tracking_number,
    'shipped_at', v_order.shipped_at
  );
END;
$function$;