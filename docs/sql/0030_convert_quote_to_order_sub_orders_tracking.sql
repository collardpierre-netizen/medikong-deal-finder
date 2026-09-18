-- ============================================================================
-- LOT 0030 — Conversion devis -> commande : inscription automatique dans le
--            suivi des déblocages de paiement fournisseur
--
-- CONTEXTE
--   Le suivi des déblocages (/admin/commandes-vendeurs-apporteur, portail
--   vendeur /vendor/suivi) part de public.sub_orders. Les sous-commandes
--   fournisseur sont créées uniquement par les tunnels d'achat
--   (edge functions create-order / stripe-webhook).
--   convert_quote_to_order (2 surcharges) crée orders + order_lines mais
--   AUCUNE sub_orders : une commande issue d'un devis n'apparaît donc jamais
--   dans le suivi des déblocages.
--
-- OBJET DU LOT
--   1. Helper idempotent public.ensure_order_sub_orders(_order_id uuid)
--      qui crée la sous-commande manquante pour chaque vendeur présent dans
--      order_lines (et met à jour le montant TVAC si elle existe déjà).
--   2. Appel de ce helper à la fin des 2 surcharges de convert_quote_to_order
--      (branche création ET branche promotion d'une commande prévisionnelle).
--   3. Rattrapage des commandes déjà converties depuis un devis et sans
--      sous-commande.
--
-- NON FAIT VOLONTAIREMENT (hors périmètre demandé)
--   - Aucune création de bon de livraison ni de ligne
--     delivery_payment_releases : la décision de déblocage reste manuelle.
--   - Aucune modification des montants, statuts, factures ou commissions
--     existants.
--   - Aucune modification des tunnels create-order / stripe-webhook.
--
-- NOTE : sub_orders n'a pas de contrainte UNIQUE (order_id, vendor_id).
--        L'idempotence est assurée par un NOT EXISTS, sans ajout de
--        contrainte (aucune migration de schéma dans ce lot).
-- ============================================================================

-- 1) Helper -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_order_sub_orders(_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_created integer := 0;
  v_pm public.payment_method_enum;
  v_ps public.payment_status_enum;
  v_due date;
  v_v record;
BEGIN
  SELECT payment_method, payment_status, payment_due_date
    INTO v_pm, v_ps, v_due
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  FOR v_v IN
    SELECT ol.vendor_id,
           ROUND(SUM(COALESCE(ol.line_total_incl_vat, 0))::numeric, 2) AS total_incl_vat
    FROM public.order_lines ol
    WHERE ol.order_id = _order_id
      AND ol.vendor_id IS NOT NULL
    GROUP BY ol.vendor_id
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.sub_orders s
      WHERE s.order_id = _order_id AND s.vendor_id = v_v.vendor_id
    ) THEN
      -- Sous-commande déjà suivie : on réaligne seulement le montant TVAC
      UPDATE public.sub_orders
         SET subtotal_incl_vat = v_v.total_incl_vat,
             updated_at = now()
       WHERE order_id = _order_id
         AND vendor_id = v_v.vendor_id
         AND subtotal_incl_vat IS DISTINCT FROM v_v.total_incl_vat;
    ELSE
      INSERT INTO public.sub_orders (
        order_id, vendor_id, fulfillment_type, status,
        subtotal_incl_vat, payment_method, payment_status, payment_due_date
      ) VALUES (
        _order_id, v_v.vendor_id,
        'vendor_direct'::public.fulfillment_type,
        'pending'::public.fulfillment_status,
        v_v.total_incl_vat,
        COALESCE(v_pm, 'invoice'::public.payment_method_enum),
        COALESCE(v_ps, 'pending'::public.payment_status_enum),
        v_due
      );
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN v_created;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_order_sub_orders(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_order_sub_orders(uuid) TO service_role;

-- 2) Surcharge 1 : convert_quote_to_order(_quote_id uuid) ---------------------
CREATE OR REPLACE FUNCTION public.convert_quote_to_order(_quote_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_order_id uuid; v_order_number text; v_line record;
  v_billing jsonb; v_shipping jsonb; v_is_forecast boolean;
  v_pm public.payment_method_enum;
  v_factor numeric;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.quotes q WHERE q.id = _quote_id AND q.vendor_id = public.current_vendor_id()
  )) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF v_quote.status <> 'paid' THEN
    RETURN jsonb_build_object('error','not_paid','status', v_quote.status::text);
  END IF;

  v_pm := CASE WHEN v_quote.payment_method='stripe' THEN 'card'::public.payment_method_enum
               ELSE 'invoice'::public.payment_method_enum END;

  SELECT * INTO v_customer FROM public.customers WHERE id = v_quote.customer_id;
  v_billing := jsonb_build_object(
    'company_name', v_customer.company_name, 'email', v_customer.email,
    'address_line1', v_customer.address_line1, 'city', v_customer.city,
    'postal_code', v_customer.postal_code, 'country_code', v_customer.country_code,
    'vat_number', v_customer.vat_number);
  v_shipping := v_billing;

  IF v_quote.order_id IS NOT NULL THEN
    SELECT is_forecast INTO v_is_forecast FROM public.orders WHERE id = v_quote.order_id;
    IF v_is_forecast IS TRUE THEN
      UPDATE public.orders SET
        status = 'confirmed'::public.order_status,
        payment_status = 'paid'::public.payment_status_enum,
        subtotal_excl_vat = v_quote.total_ht_cents/100.0,
        vat_amount = v_quote.total_tva_cents/100.0,
        total_incl_vat = v_quote.total_ttc_cents/100.0,
        billing_address = v_billing,
        shipping_address = COALESCE(shipping_address, v_shipping),
        is_forecast = false, was_forecast = true,
        forecast_converted_at = now(),
        admin_notes = COALESCE(admin_notes,'') || ' [Converti depuis devis ' || v_quote.quote_number || ']',
        updated_at = now()
      WHERE id = v_quote.order_id;
      UPDATE public.quotes SET status='converted'::public.quote_status,
             converted_at=now(), updated_at=now() WHERE id=_quote_id;
      PERFORM public.ensure_order_sub_orders(v_quote.order_id);
      RETURN jsonb_build_object('ok', true, 'order_id', v_quote.order_id, 'promoted', true);
    ELSE
      RETURN jsonb_build_object('ok', true, 'order_id', v_quote.order_id, 'already_converted', true);
    END IF;
  END IF;

  v_order_number := 'MK-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.quote_number_seq')::text,5,'0');
  INSERT INTO public.orders (
    order_number, customer_id, source, status,
    subtotal_excl_vat, vat_amount, total_incl_vat,
    shipping_address, billing_address, payment_method, payment_status,
    notes, admin_notes, created_by_admin, is_forecast
  ) VALUES (
    v_order_number, v_quote.customer_id,
    'manual_admin'::public.order_source, 'confirmed'::public.order_status,
    v_quote.total_ht_cents/100.0, v_quote.total_tva_cents/100.0, v_quote.total_ttc_cents/100.0,
    v_shipping, v_billing, v_pm, 'paid'::public.payment_status_enum,
    v_quote.notes_customer, 'Converti depuis devis '||v_quote.quote_number,
    v_quote.created_by_user_id, false
  ) RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM public.quote_lines WHERE quote_id=_quote_id ORDER BY sort_order, created_at LOOP
    v_factor := 1 + (CASE WHEN COALESCE(v_line.vat_rate,0) > 1 THEN v_line.vat_rate/100.0 ELSE COALESCE(v_line.vat_rate,0) END);
    INSERT INTO public.order_lines (
      order_id, product_id, offer_id, vendor_id, manual_label,
      quantity, unit_price_excl_vat, unit_price_incl_vat, vat_rate,
      line_total_excl_vat, line_total_incl_vat,
      vendor_reference
    ) VALUES (
      v_order_id, v_line.product_id, v_line.offer_id, v_quote.vendor_id, v_line.label,
      v_line.qty,
      ROUND(v_line.unit_price_ht_cents/100.0, 2),
      ROUND((v_line.unit_price_ht_cents/100.0) * v_factor, 2),
      v_line.vat_rate,
      ROUND(v_line.total_ht_cents/100.0, 2),
      ROUND(v_line.total_ttc_cents/100.0, 2),
      v_line.vendor_reference);
  END LOOP;

  UPDATE public.quotes SET status='converted'::public.quote_status,
         order_id=v_order_id, converted_at=now(), updated_at=now() WHERE id=_quote_id;

  PERFORM public.ensure_order_sub_orders(v_order_id);

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id);
END;
$function$;

-- 3) Surcharge 2 : convert_quote_to_order(_quote_id uuid, _force boolean) -----
CREATE OR REPLACE FUNCTION public.convert_quote_to_order(_quote_id uuid, _force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_order_id uuid; v_order_number text; v_line record;
  v_billing jsonb; v_shipping jsonb; v_is_forecast boolean;
  v_pm public.payment_method_enum;
  v_is_admin boolean;
  v_factor numeric;
BEGIN
  v_is_admin := public.is_admin(auth.uid());
  IF NOT (v_is_admin OR EXISTS (
    SELECT 1 FROM public.quotes q WHERE q.id = _quote_id AND q.vendor_id = public.current_vendor_id()
  )) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;

  IF v_quote.status <> 'paid' AND NOT (_force AND v_is_admin) THEN
    RETURN jsonb_build_object('error','not_paid','status', v_quote.status::text);
  END IF;

  IF v_quote.status = 'converted' AND v_quote.order_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'order_id', v_quote.order_id, 'already_converted', true);
  END IF;

  v_pm := CASE WHEN v_quote.payment_method='stripe' THEN 'card'::public.payment_method_enum
               ELSE 'invoice'::public.payment_method_enum END;

  SELECT * INTO v_customer FROM public.customers WHERE id = v_quote.customer_id;
  v_billing := jsonb_build_object(
    'company_name', v_customer.company_name, 'email', v_customer.email,
    'address_line1', v_customer.address_line1, 'city', v_customer.city,
    'postal_code', v_customer.postal_code, 'country_code', v_customer.country_code,
    'vat_number', v_customer.vat_number);
  v_shipping := v_billing;

  IF v_quote.order_id IS NOT NULL THEN
    SELECT is_forecast INTO v_is_forecast FROM public.orders WHERE id = v_quote.order_id;
    IF v_is_forecast IS TRUE THEN
      UPDATE public.orders SET
        status = 'confirmed'::public.order_status,
        payment_status = CASE WHEN v_quote.status='paid' THEN 'paid'::public.payment_status_enum ELSE 'pending'::public.payment_status_enum END,
        subtotal_excl_vat = v_quote.total_ht_cents/100.0,
        vat_amount = v_quote.total_tva_cents/100.0,
        total_incl_vat = v_quote.total_ttc_cents/100.0,
        billing_address = v_billing,
        shipping_address = COALESCE(shipping_address, v_shipping),
        is_forecast = false, was_forecast = true,
        forecast_converted_at = now(),
        admin_notes = COALESCE(admin_notes,'') || ' [Converti' || CASE WHEN _force AND v_quote.status<>'paid' THEN ' (manuel, statut '||v_quote.status::text||')' ELSE '' END || ' depuis devis ' || v_quote.quote_number || ']',
        updated_at = now()
      WHERE id = v_quote.order_id;
      UPDATE public.quotes SET status='converted'::public.quote_status,
             converted_at=now(), updated_at=now() WHERE id=_quote_id;
      PERFORM public.ensure_order_sub_orders(v_quote.order_id);
      RETURN jsonb_build_object('ok', true, 'order_id', v_quote.order_id, 'promoted', true, 'forced', _force AND v_quote.status<>'paid');
    ELSE
      RETURN jsonb_build_object('ok', true, 'order_id', v_quote.order_id, 'already_converted', true);
    END IF;
  END IF;

  v_order_number := 'MK-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.quote_number_seq')::text,5,'0');
  INSERT INTO public.orders (
    order_number, customer_id, source, status,
    subtotal_excl_vat, vat_amount, total_incl_vat,
    shipping_address, billing_address, payment_method, payment_status,
    notes, admin_notes, created_by_admin, is_forecast
  ) VALUES (
    v_order_number, v_quote.customer_id,
    'manual_admin'::public.order_source, 'confirmed'::public.order_status,
    v_quote.total_ht_cents/100.0, v_quote.total_tva_cents/100.0, v_quote.total_ttc_cents/100.0,
    v_shipping, v_billing, v_pm,
    CASE WHEN v_quote.status='paid' THEN 'paid'::public.payment_status_enum ELSE 'pending'::public.payment_status_enum END,
    v_quote.notes_customer,
    'Converti' || CASE WHEN _force AND v_quote.status<>'paid' THEN ' (manuel, statut '||v_quote.status::text||')' ELSE '' END || ' depuis devis '||v_quote.quote_number,
    v_quote.created_by_user_id, false
  ) RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM public.quote_lines WHERE quote_id=_quote_id ORDER BY sort_order, created_at LOOP
    v_factor := 1 + (CASE WHEN COALESCE(v_line.vat_rate,0) > 1 THEN v_line.vat_rate/100.0 ELSE COALESCE(v_line.vat_rate,0) END);
    INSERT INTO public.order_lines (
      order_id, product_id, offer_id, vendor_id, manual_label,
      quantity, unit_price_excl_vat, unit_price_incl_vat, vat_rate,
      line_total_excl_vat, line_total_incl_vat,
      vendor_reference
    ) VALUES (
      v_order_id, v_line.product_id, v_line.offer_id, v_quote.vendor_id, v_line.label,
      v_line.qty,
      ROUND(v_line.unit_price_ht_cents/100.0, 2),
      ROUND((v_line.unit_price_ht_cents/100.0) * v_factor, 2),
      v_line.vat_rate,
      ROUND(v_line.total_ht_cents/100.0, 2),
      ROUND(v_line.total_ttc_cents/100.0, 2),
      v_line.vendor_reference);
  END LOOP;

  UPDATE public.quotes SET status='converted'::public.quote_status,
         order_id=v_order_id, converted_at=now(), updated_at=now() WHERE id=_quote_id;

  PERFORM public.ensure_order_sub_orders(v_order_id);

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'forced', _force AND v_quote.status<>'paid');
END;
$function$;

-- 4) Rattrapage des commandes déjà converties sans sous-commande --------------
DO $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT q.order_id
    FROM public.quotes q
    WHERE q.order_id IS NOT NULL
      AND q.status = 'converted'
      AND EXISTS (SELECT 1 FROM public.order_lines ol WHERE ol.order_id = q.order_id AND ol.vendor_id IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM public.sub_orders s WHERE s.order_id = q.order_id)
  LOOP
    n := n + public.ensure_order_sub_orders(r.order_id);
  END LOOP;
  RAISE NOTICE 'Rattrapage: % sous-commande(s) créée(s)', n;
END $$;
