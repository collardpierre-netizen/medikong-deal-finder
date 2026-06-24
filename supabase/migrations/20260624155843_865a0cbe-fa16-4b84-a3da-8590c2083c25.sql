
DO $$ BEGIN
  CREATE TYPE public.quote_status AS ENUM ('draft','sent','accepted','paid','declined','converted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.quote_payment_method AS ENUM ('invoice','stripe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_num bigint;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_num := nextval('public.quote_number_seq');
  RETURN 'Q-' || v_year || '-' || lpad(v_num::text, 4, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text NOT NULL UNIQUE DEFAULT public.generate_quote_number(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.quote_status NOT NULL DEFAULT 'draft',
  payment_method public.quote_payment_method NOT NULL DEFAULT 'invoice',
  public_token text UNIQUE,
  token_expires_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  accepted_ip text,
  declined_at timestamptz,
  paid_at timestamptz,
  converted_at timestamptz,
  stripe_session_id text,
  stripe_payment_intent_id text,
  total_ht_cents bigint NOT NULL DEFAULT 0,
  total_tva_cents bigint NOT NULL DEFAULT 0,
  total_ttc_cents bigint NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'EUR',
  pdf_storage_path text,
  notes_internal text,
  notes_customer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

CREATE INDEX IF NOT EXISTS idx_quotes_vendor ON public.quotes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON public.quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_public_token ON public.quotes(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON public.quotes(created_at DESC);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all quotes"
ON public.quotes FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Vendors read own quotes"
ON public.quotes FOR SELECT TO authenticated
USING (vendor_id = public.current_vendor_id());

CREATE POLICY "Vendors insert own quotes"
ON public.quotes FOR INSERT TO authenticated
WITH CHECK (vendor_id = public.current_vendor_id());

CREATE POLICY "Vendors update own quotes"
ON public.quotes FOR UPDATE TO authenticated
USING (vendor_id = public.current_vendor_id())
WITH CHECK (vendor_id = public.current_vendor_id());

DROP TRIGGER IF EXISTS trg_quotes_updated_at ON public.quotes;
CREATE TRIGGER trg_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  label text NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  unit_price_ht_cents bigint NOT NULL CHECK (unit_price_ht_cents >= 0),
  vat_rate numeric(5,2) NOT NULL DEFAULT 21,
  total_ht_cents bigint NOT NULL DEFAULT 0,
  total_ttc_cents bigint NOT NULL DEFAULT 0,
  unit_cost_ht_cents bigint,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_lines TO authenticated;
GRANT ALL ON public.quote_lines TO service_role;

CREATE INDEX IF NOT EXISTS idx_quote_lines_quote ON public.quote_lines(quote_id);

ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all quote lines"
ON public.quote_lines FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Vendors read own quote lines"
ON public.quote_lines FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_lines.quote_id AND q.vendor_id = public.current_vendor_id()));

CREATE POLICY "Vendors insert own quote lines"
ON public.quote_lines FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_lines.quote_id AND q.vendor_id = public.current_vendor_id()));

CREATE POLICY "Vendors update own quote lines"
ON public.quote_lines FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_lines.quote_id AND q.vendor_id = public.current_vendor_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_lines.quote_id AND q.vendor_id = public.current_vendor_id()));

CREATE POLICY "Vendors delete own quote lines"
ON public.quote_lines FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_lines.quote_id AND q.vendor_id = public.current_vendor_id()));

DROP TRIGGER IF EXISTS trg_quote_lines_updated_at ON public.quote_lines;
CREATE TRIGGER trg_quote_lines_updated_at
BEFORE UPDATE ON public.quote_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.recompute_quote_totals(_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.quotes q
  SET
    total_ht_cents = COALESCE((SELECT SUM(total_ht_cents) FROM public.quote_lines WHERE quote_id = _quote_id), 0),
    total_ttc_cents = COALESCE((SELECT SUM(total_ttc_cents) FROM public.quote_lines WHERE quote_id = _quote_id), 0),
    total_tva_cents = COALESCE((SELECT SUM(total_ttc_cents - total_ht_cents) FROM public.quote_lines WHERE quote_id = _quote_id), 0),
    updated_at = now()
  WHERE q.id = _quote_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_quote_lines_recompute()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    NEW.total_ht_cents := NEW.unit_price_ht_cents * NEW.qty;
    NEW.total_ttc_cents := ROUND(NEW.total_ht_cents * (1 + NEW.vat_rate / 100.0))::bigint;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_lines_compute ON public.quote_lines;
CREATE TRIGGER trg_quote_lines_compute
BEFORE INSERT OR UPDATE ON public.quote_lines
FOR EACH ROW EXECUTE FUNCTION public.trg_quote_lines_recompute();

CREATE OR REPLACE FUNCTION public.trg_quote_lines_after_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_quote_totals(OLD.quote_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_quote_totals(NEW.quote_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_lines_after ON public.quote_lines;
CREATE TRIGGER trg_quote_lines_after
AFTER INSERT OR UPDATE OR DELETE ON public.quote_lines
FOR EACH ROW EXECUTE FUNCTION public.trg_quote_lines_after_change();

CREATE OR REPLACE FUNCTION public.get_quote_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT jsonb_build_object(
    'name', v.name,
    'company_name', v.company_name,
    'logo_url', v.logo_url
  ) INTO v_vendor
  FROM public.vendors v WHERE v.id = v_quote.vendor_id;

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
    'lines', COALESCE(v_lines, '[]'::jsonb),
    'customer', v_customer,
    'vendor', v_vendor
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_quote_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.quote_public_action(
  _token text,
  _action text,
  _ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote public.quotes%ROWTYPE;
BEGIN
  IF _action NOT IN ('accept','decline') THEN
    RETURN jsonb_build_object('error','invalid_action');
  END IF;

  SELECT * INTO v_quote FROM public.quotes
  WHERE public_token = _token AND public_token IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','not_found');
  END IF;
  IF v_quote.token_expires_at IS NOT NULL AND v_quote.token_expires_at < now() THEN
    RETURN jsonb_build_object('error','expired');
  END IF;
  IF v_quote.status <> 'sent' THEN
    RETURN jsonb_build_object('error','already_processed','status', v_quote.status::text);
  END IF;

  IF _action = 'accept' THEN
    UPDATE public.quotes SET status = 'accepted', accepted_at = now(), accepted_ip = _ip WHERE id = v_quote.id;
  ELSE
    UPDATE public.quotes SET status = 'declined', declined_at = now() WHERE id = v_quote.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN _action='accept' THEN 'accepted' ELSE 'declined' END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.quote_public_action(text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.convert_quote_to_order(_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_order_id uuid;
  v_order_number text;
  v_line record;
  v_billing jsonb;
  v_shipping jsonb;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = _quote_id AND q.vendor_id = public.current_vendor_id()
  )) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','not_found');
  END IF;
  IF v_quote.status <> 'paid' THEN
    RETURN jsonb_build_object('error','not_paid','status', v_quote.status::text);
  END IF;
  IF v_quote.order_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'order_id', v_quote.order_id, 'already_converted', true);
  END IF;

  SELECT * INTO v_customer FROM public.customers WHERE id = v_quote.customer_id;

  v_billing := jsonb_build_object(
    'company_name', v_customer.company_name,
    'email', v_customer.email,
    'address_line1', v_customer.address_line1,
    'city', v_customer.city,
    'postal_code', v_customer.postal_code,
    'country_code', v_customer.country_code,
    'vat_number', v_customer.vat_number
  );
  v_shipping := v_billing;

  v_order_number := 'MK-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quote_number_seq')::text, 5, '0');

  INSERT INTO public.orders (
    order_number, customer_id, source, status,
    subtotal_excl_vat, vat_amount, total_incl_vat,
    shipping_address, billing_address,
    payment_method, payment_status,
    notes, admin_notes,
    created_by_admin,
    is_forecast
  ) VALUES (
    v_order_number,
    v_quote.customer_id,
    'manual'::public.order_source,
    'confirmed'::public.order_status,
    v_quote.total_ht_cents / 100.0,
    v_quote.total_tva_cents / 100.0,
    v_quote.total_ttc_cents / 100.0,
    v_shipping,
    v_billing,
    CASE WHEN v_quote.payment_method = 'stripe' THEN 'stripe'::public.payment_method ELSE 'invoice'::public.payment_method END,
    'paid'::public.payment_status,
    v_quote.notes_customer,
    'Converti depuis devis ' || v_quote.quote_number,
    v_quote.created_by_user_id,
    false
  ) RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM public.quote_lines WHERE quote_id = _quote_id ORDER BY sort_order, created_at LOOP
    INSERT INTO public.order_lines (
      order_id, offer_id, product_id, vendor_id,
      quantity, unit_price_excl_vat, unit_price_incl_vat, vat_rate,
      line_total_excl_vat, line_total_incl_vat,
      cost_price, line_cost,
      fulfillment_type, fulfillment_status,
      manual_label
    ) VALUES (
      v_order_id,
      v_line.offer_id,
      v_line.product_id,
      v_quote.vendor_id,
      v_line.qty,
      v_line.unit_price_ht_cents / 100.0,
      v_line.total_ttc_cents::numeric / NULLIF(v_line.qty, 0) / 100.0,
      v_line.vat_rate,
      v_line.total_ht_cents / 100.0,
      v_line.total_ttc_cents / 100.0,
      v_line.unit_cost_ht_cents / 100.0,
      (v_line.unit_cost_ht_cents * v_line.qty) / 100.0,
      'vendor'::public.fulfillment_type,
      'pending'::public.fulfillment_status,
      v_line.label
    );
  END LOOP;

  UPDATE public.quotes
  SET status = 'converted', converted_at = now(), order_id = v_order_id
  WHERE id = _quote_id;

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'order_number', v_order_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_quote_to_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_quote_paid(_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_conv jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','not_found');
  END IF;
  IF v_quote.status NOT IN ('accepted','sent') THEN
    RETURN jsonb_build_object('error','invalid_status','status', v_quote.status::text);
  END IF;

  UPDATE public.quotes
  SET status = 'paid', paid_at = now(),
      accepted_at = COALESCE(accepted_at, now())
  WHERE id = _quote_id;

  v_conv := public.convert_quote_to_order(_quote_id);
  RETURN jsonb_build_object('ok', true, 'order_id', v_conv->>'order_id');
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_quote_paid(uuid) TO authenticated;
