-- 1. Numérotation BL
ALTER TABLE public.document_number_sequences
  DROP CONSTRAINT IF EXISTS document_number_sequences_document_type_check;
ALTER TABLE public.document_number_sequences
  ADD CONSTRAINT document_number_sequences_document_type_check
  CHECK (document_type IN ('sale','commission_invoice','credit_note','delivery_note'));

CREATE OR REPLACE FUNCTION public.generate_document_number(p_document_type text, p_year int DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year   int := COALESCE(p_year, EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Brussels'))::int);
  v_prefix text;
  v_pad    int;
  v_next   int;
BEGIN
  v_prefix := CASE p_document_type
    WHEN 'sale'               THEN 'MK'
    WHEN 'commission_invoice' THEN 'COM'
    WHEN 'credit_note'        THEN 'NC'
    WHEN 'delivery_note'      THEN 'BL'
    ELSE NULL
  END;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Type de document inconnu: %', p_document_type;
  END IF;

  v_pad := CASE p_document_type WHEN 'sale' THEN 5 ELSE 4 END;

  INSERT INTO public.document_number_sequences (document_type, year, last_number)
  VALUES (p_document_type, v_year, 0)
  ON CONFLICT (document_type, year) DO NOTHING;

  UPDATE public.document_number_sequences
     SET last_number = last_number + 1,
         updated_at  = now()
   WHERE document_type = p_document_type AND year = v_year
  RETURNING last_number INTO v_next;

  RETURN v_prefix || '-' || v_year || '-' ||
         CASE WHEN v_next > (10 ^ v_pad - 1)::int
              THEN v_next::text
              ELSE lpad(v_next::text, v_pad, '0')
         END;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_document_number(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_document_number(text, int) TO service_role;

-- 2. Reliquat manuel sur les lignes
ALTER TABLE public.order_lines
  ADD COLUMN IF NOT EXISTS backorder_status text
    CHECK (backorder_status IS NULL OR backorder_status IN ('open','cancelled','undeliverable')),
  ADD COLUMN IF NOT EXISTS backorder_note text,
  ADD COLUMN IF NOT EXISTS backorder_updated_at timestamptz;

-- 3. Tables BL
CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  document_number text UNIQUE,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','cancelled')),
  carrier text,
  tracking_number text,
  note text,
  shipping_address jsonb,
  issued_by uuid,
  issued_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_order ON public.delivery_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_vendor ON public.delivery_notes(vendor_id);

GRANT SELECT ON public.delivery_notes TO authenticated;
GRANT ALL ON public.delivery_notes TO service_role;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read delivery notes" ON public.delivery_notes
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Vendors read own delivery notes" ON public.delivery_notes
  FOR SELECT TO authenticated USING (vendor_id IS NOT NULL AND vendor_id = public.current_vendor_id());

CREATE TABLE IF NOT EXISTS public.delivery_note_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id uuid NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  order_line_id uuid NOT NULL REFERENCES public.order_lines(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_note_id, order_line_id)
);
CREATE INDEX IF NOT EXISTS idx_delivery_note_lines_line ON public.delivery_note_lines(order_line_id);

GRANT SELECT ON public.delivery_note_lines TO authenticated;
GRANT ALL ON public.delivery_note_lines TO service_role;
ALTER TABLE public.delivery_note_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read delivery note lines" ON public.delivery_note_lines
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.delivery_notes dn
      WHERE dn.id = delivery_note_id
        AND (public.is_admin() OR (dn.vendor_id IS NOT NULL AND dn.vendor_id = public.current_vendor_id()))
    )
  );

CREATE TRIGGER trg_delivery_notes_updated_at
  BEFORE UPDATE ON public.delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Etat de livraison d'une commande
CREATE OR REPLACE FUNCTION public.get_order_delivery_status(_order_id uuid)
RETURNS TABLE (
  order_line_id uuid,
  vendor_id uuid,
  product_name text,
  cnk_code text,
  gtin text,
  quantity integer,
  delivered_quantity integer,
  remaining_quantity integer,
  backorder_status text,
  backorder_note text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ol.id,
         ol.vendor_id,
         COALESCE(ol.manual_label, p.name)::text,
         p.cnk_code::text,
         p.gtin::text,
         ol.quantity,
         COALESCE(d.delivered, 0)::int,
         GREATEST(ol.quantity - COALESCE(d.delivered, 0), 0)::int,
         ol.backorder_status,
         ol.backorder_note
  FROM public.order_lines ol
  LEFT JOIN public.products p ON p.id = ol.product_id
  LEFT JOIN LATERAL (
    SELECT SUM(dnl.quantity)::int AS delivered
    FROM public.delivery_note_lines dnl
    JOIN public.delivery_notes dn ON dn.id = dnl.delivery_note_id
    WHERE dnl.order_line_id = ol.id AND dn.status = 'issued'
  ) d ON true
  WHERE ol.order_id = _order_id
    AND (
      public.is_admin()
      OR (public.current_vendor_id() IS NOT NULL AND ol.vendor_id = public.current_vendor_id())
    )
  ORDER BY COALESCE(ol.manual_label, p.name);
$$;
REVOKE ALL ON FUNCTION public.get_order_delivery_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_delivery_status(uuid) TO authenticated, service_role;

-- 5. Création d'un BL
CREATE OR REPLACE FUNCTION public.create_delivery_note(
  _order_id uuid,
  _lines jsonb,
  _carrier text DEFAULT NULL,
  _tracking_number text DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.is_admin();
  v_vendor uuid := public.current_vendor_id();
  v_dn uuid;
  v_number text;
  v_item jsonb;
  v_line record;
  v_qty int;
  v_delivered int;
  v_vendors uuid[] := '{}';
  v_count int := 0;
BEGIN
  IF NOT v_is_admin AND v_vendor IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF _lines IS NULL OR jsonb_array_length(_lines) = 0 THEN
    RAISE EXCEPTION 'no_lines';
  END IF;

  v_number := public.generate_document_number('delivery_note');

  INSERT INTO public.delivery_notes (order_id, vendor_id, document_number, carrier, tracking_number, note, shipping_address, issued_by)
  SELECT _order_id, CASE WHEN v_is_admin THEN NULL ELSE v_vendor END, v_number,
         NULLIF(_carrier,''), NULLIF(_tracking_number,''), NULLIF(_note,''), o.shipping_address, auth.uid()
  FROM public.orders o WHERE o.id = _order_id
  RETURNING id INTO v_dn;

  IF v_dn IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_lines)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT ol.* INTO v_line FROM public.order_lines ol
      WHERE ol.id = (v_item->>'order_line_id')::uuid AND ol.order_id = _order_id;
    IF v_line.id IS NULL THEN
      RAISE EXCEPTION 'line_not_in_order';
    END IF;
    IF NOT v_is_admin AND v_line.vendor_id IS DISTINCT FROM v_vendor THEN
      RAISE EXCEPTION 'forbidden_line';
    END IF;

    SELECT COALESCE(SUM(dnl.quantity), 0)::int INTO v_delivered
    FROM public.delivery_note_lines dnl
    JOIN public.delivery_notes dn ON dn.id = dnl.delivery_note_id
    WHERE dnl.order_line_id = v_line.id AND dn.status = 'issued';

    IF v_qty > (v_line.quantity - v_delivered) THEN
      RAISE EXCEPTION 'quantity_exceeds_remaining';
    END IF;

    INSERT INTO public.delivery_note_lines (delivery_note_id, order_line_id, quantity)
    VALUES (v_dn, v_line.id, v_qty);

    UPDATE public.order_lines
       SET quantity_shipped = v_delivered + v_qty,
           backorder_status = CASE
             WHEN (v_delivered + v_qty) >= quantity THEN NULL
             WHEN backorder_status IS NULL THEN 'open'
             ELSE backorder_status END,
           backorder_updated_at = now(),
           updated_at = now()
     WHERE id = v_line.id;

    IF v_line.vendor_id IS NOT NULL AND NOT (v_line.vendor_id = ANY(v_vendors)) THEN
      v_vendors := v_vendors || v_line.vendor_id;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'no_lines';
  END IF;

  -- BL admin ne portant que sur un seul fournisseur : on le rattache
  IF v_is_admin AND array_length(v_vendors, 1) = 1 THEN
    UPDATE public.delivery_notes SET vendor_id = v_vendors[1] WHERE id = v_dn;
  END IF;

  RETURN v_dn;
END;
$$;
REVOKE ALL ON FUNCTION public.create_delivery_note(uuid, jsonb, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_delivery_note(uuid, jsonb, text, text, text) TO authenticated, service_role;

-- 6. Annulation d'un BL
CREATE OR REPLACE FUNCTION public.cancel_delivery_note(_delivery_note_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dn record;
BEGIN
  SELECT * INTO v_dn FROM public.delivery_notes WHERE id = _delivery_note_id;
  IF v_dn.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.is_admin() AND (v_dn.vendor_id IS NULL OR v_dn.vendor_id IS DISTINCT FROM public.current_vendor_id()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF v_dn.status = 'cancelled' THEN RETURN; END IF;

  UPDATE public.delivery_notes
     SET status = 'cancelled', cancelled_at = now(), cancellation_reason = NULLIF(_reason,'')
   WHERE id = _delivery_note_id;

  UPDATE public.order_lines ol
     SET quantity_shipped = COALESCE((
           SELECT SUM(dnl.quantity)::int
           FROM public.delivery_note_lines dnl
           JOIN public.delivery_notes dn ON dn.id = dnl.delivery_note_id
           WHERE dnl.order_line_id = ol.id AND dn.status = 'issued'
         ), 0),
         updated_at = now()
   WHERE ol.id IN (SELECT order_line_id FROM public.delivery_note_lines WHERE delivery_note_id = _delivery_note_id);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_delivery_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_delivery_note(uuid, text) TO authenticated, service_role;

-- 7. Statut manuel du reliquat
CREATE OR REPLACE FUNCTION public.set_order_line_backorder_status(_order_line_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line record;
BEGIN
  IF _status IS NOT NULL AND _status NOT IN ('open','cancelled','undeliverable') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  SELECT * INTO v_line FROM public.order_lines WHERE id = _order_line_id;
  IF v_line.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.is_admin() AND (public.current_vendor_id() IS NULL OR v_line.vendor_id IS DISTINCT FROM public.current_vendor_id()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.order_lines
     SET backorder_status = _status,
         backorder_note = NULLIF(_note,''),
         backorder_updated_at = now(),
         updated_at = now()
   WHERE id = _order_line_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_order_line_backorder_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_order_line_backorder_status(uuid, text, text) TO authenticated, service_role;