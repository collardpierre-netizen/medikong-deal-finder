
CREATE TABLE IF NOT EXISTS public.sub_order_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sub_order_id uuid REFERENCES public.sub_orders(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  payment_intent_id text,
  stripe_session_id text,
  order_number text,
  source text NOT NULL DEFAULT 'fanout',
  was_existing boolean NOT NULL DEFAULT false,
  line_count integer NOT NULL DEFAULT 0,
  subtotal_incl_vat numeric,
  cost_total numeric,
  margin_total numeric,
  commission_rate_override numeric,
  commission_amount_override numeric,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sub_order_generation_logs TO authenticated;
GRANT ALL ON public.sub_order_generation_logs TO service_role;

ALTER TABLE public.sub_order_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read sub_order generation logs"
  ON public.sub_order_generation_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "service_role manage sub_order generation logs"
  ON public.sub_order_generation_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sub_order_gen_logs_order ON public.sub_order_generation_logs(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_order_gen_logs_vendor ON public.sub_order_generation_logs(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_order_gen_logs_pi ON public.sub_order_generation_logs(payment_intent_id) WHERE payment_intent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fanout_order_to_vendors(_order_id uuid)
 RETURNS TABLE(vendor_id uuid, vendor_email text, vendor_name text, sub_order_id uuid, vendor_subtotal_incl_vat numeric, line_count integer, order_number text, order_total_incl_vat numeric, magic_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_rec record;
  v_sub_id uuid;
  v_token text;
  v_existing_token text;
  v_was_existing boolean;
  v_lines_payload jsonb;
  v_source text;
  v_actor uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', _order_id;
  END IF;

  BEGIN
    v_source := current_setting('app.fanout_source', true);
  EXCEPTION WHEN OTHERS THEN v_source := NULL; END;
  IF v_source IS NULL OR v_source = '' THEN v_source := 'fanout'; END IF;

  BEGIN
    v_actor := auth.uid();
  EXCEPTION WHEN OTHERS THEN v_actor := NULL; END;

  FOR v_rec IN
    SELECT
      ol.vendor_id AS vendor_id,
      COALESCE(MAX(ol.fulfillment_type::text), 'vendor_direct')::fulfillment_type AS fulfillment_type,
      SUM(ol.line_total_incl_vat) AS subtotal_incl_vat,
      SUM(ol.line_cost) AS cost_total,
      SUM(ol.line_margin) AS margin_total,
      COUNT(*)::int AS line_count,
      COALESCE(v.contact_email, v.shipping_email, v.email) AS vendor_email,
      COALESCE(v.company_name, v.name, 'Vendeur') AS vendor_name
    FROM public.order_lines ol
    JOIN public.vendors v ON v.id = ol.vendor_id
    WHERE ol.order_id = _order_id
    GROUP BY ol.vendor_id, v.contact_email, v.shipping_email, v.email, v.company_name, v.name
  LOOP
    SELECT so.id INTO v_sub_id
    FROM public.sub_orders so
    WHERE so.order_id = _order_id AND so.vendor_id = v_rec.vendor_id
    LIMIT 1;

    v_was_existing := (v_sub_id IS NOT NULL);

    IF v_sub_id IS NULL THEN
      INSERT INTO public.sub_orders (
        order_id, vendor_id, fulfillment_type, status,
        subtotal_incl_vat, cost_total, margin_total
      ) VALUES (
        _order_id, v_rec.vendor_id, v_rec.fulfillment_type, 'pending',
        COALESCE(v_rec.subtotal_incl_vat, 0),
        v_rec.cost_total,
        v_rec.margin_total
      )
      RETURNING id INTO v_sub_id;

      INSERT INTO public.order_line_sub_orders (order_line_id, sub_order_id)
      SELECT ol.id, v_sub_id
      FROM public.order_lines ol
      WHERE ol.order_id = _order_id AND ol.vendor_id = v_rec.vendor_id
      ON CONFLICT DO NOTHING;

      INSERT INTO public.vendor_notifications (
        vendor_id, type, title, body, cta_url, metadata
      ) VALUES (
        v_rec.vendor_id,
        'order_new',
        'Nouvelle commande à traiter',
        format('%s ligne(s) à préparer pour la commande %s', v_rec.line_count, v_order.order_number),
        '/vendor/commandes',
        jsonb_build_object(
          'order_id', _order_id,
          'sub_order_id', v_sub_id,
          'order_number', v_order.order_number
        )
      );

      INSERT INTO public.vendor_notification_dispatch_log (
        vendor_id, source_type, source_id
      ) VALUES (
        v_rec.vendor_id, 'order_new', v_sub_id
      ) ON CONFLICT DO NOTHING;
    END IF;

    SELECT t.token INTO v_existing_token
    FROM public.vendor_order_tokens t
    WHERE t.sub_order_id = v_sub_id
    LIMIT 1;

    IF v_existing_token IS NULL THEN
      v_token := encode(gen_random_bytes(32), 'base64');
      v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

      INSERT INTO public.vendor_order_tokens (
        sub_order_id, order_id, vendor_id, order_number, token
      ) VALUES (
        v_sub_id, _order_id, v_rec.vendor_id, v_order.order_number, v_token
      );
    ELSE
      v_token := v_existing_token;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'order_line_id', ol.id,
      'product_id', ol.product_id,
      'product_name', p.name,
      'gtin', p.gtin,
      'cnk_code', p.cnk_code,
      'quantity', ol.quantity,
      'unit_price_excl_vat', ol.unit_price_excl_vat,
      'vat_rate', ol.vat_rate,
      'line_total_excl_vat', ol.line_total_excl_vat,
      'line_total_incl_vat', ol.line_total_incl_vat,
      'unit_cost_excl_vat', ol.unit_cost_excl_vat,
      'line_cost', ol.line_cost,
      'line_margin', ol.line_margin,
      'commission_rate', ol.commission_rate,
      'commission_amount', ol.commission_amount,
      'commission_basis', ol.commission_basis
    ) ORDER BY ol.id), '[]'::jsonb)
    INTO v_lines_payload
    FROM public.order_lines ol
    LEFT JOIN public.products p ON p.id = ol.product_id
    WHERE ol.order_id = _order_id AND ol.vendor_id = v_rec.vendor_id;

    INSERT INTO public.sub_order_generation_logs (
      order_id, sub_order_id, vendor_id,
      payment_intent_id, stripe_session_id, order_number,
      source, was_existing, line_count,
      subtotal_incl_vat, cost_total, margin_total,
      commission_rate_override, commission_amount_override,
      lines, actor_user_id, metadata
    )
    SELECT
      _order_id, v_sub_id, v_rec.vendor_id,
      v_order.stripe_payment_intent_id, v_order.stripe_session_id, v_order.order_number,
      v_source, v_was_existing, v_rec.line_count,
      COALESCE(v_rec.subtotal_incl_vat, 0), v_rec.cost_total, v_rec.margin_total,
      so.commission_rate_override, so.commission_amount_override,
      v_lines_payload, v_actor,
      jsonb_build_object(
        'vendor_email', v_rec.vendor_email,
        'vendor_name', v_rec.vendor_name,
        'fulfillment_type', v_rec.fulfillment_type
      )
    FROM public.sub_orders so
    WHERE so.id = v_sub_id;

    fanout_order_to_vendors.vendor_id := v_rec.vendor_id;
    fanout_order_to_vendors.vendor_email := v_rec.vendor_email;
    fanout_order_to_vendors.vendor_name := v_rec.vendor_name;
    fanout_order_to_vendors.sub_order_id := v_sub_id;
    fanout_order_to_vendors.vendor_subtotal_incl_vat := COALESCE(v_rec.subtotal_incl_vat, 0);
    fanout_order_to_vendors.line_count := v_rec.line_count;
    fanout_order_to_vendors.order_number := v_order.order_number;
    fanout_order_to_vendors.order_total_incl_vat := v_order.total_incl_vat;
    fanout_order_to_vendors.magic_token := v_token;
    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_sub_order_generation_logs(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logs jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'created_at', l.created_at,
    'source', l.source,
    'was_existing', l.was_existing,
    'sub_order_id', l.sub_order_id,
    'vendor_id', l.vendor_id,
    'vendor_label', COALESCE(v.company_name, v.name, 'Fournisseur'),
    'payment_intent_id', l.payment_intent_id,
    'stripe_session_id', l.stripe_session_id,
    'order_number', l.order_number,
    'line_count', l.line_count,
    'subtotal_incl_vat', l.subtotal_incl_vat,
    'cost_total', l.cost_total,
    'margin_total', l.margin_total,
    'commission_rate_override', l.commission_rate_override,
    'commission_amount_override', l.commission_amount_override,
    'lines', l.lines,
    'actor_user_id', l.actor_user_id,
    'metadata', l.metadata
  ) ORDER BY l.created_at DESC), '[]'::jsonb)
  INTO v_logs
  FROM public.sub_order_generation_logs l
  LEFT JOIN public.vendors v ON v.id = l.vendor_id
  WHERE l.order_id = _order_id;

  RETURN v_logs;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_sub_order_generation_logs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_sub_order_generation_logs(uuid) TO authenticated, service_role;
