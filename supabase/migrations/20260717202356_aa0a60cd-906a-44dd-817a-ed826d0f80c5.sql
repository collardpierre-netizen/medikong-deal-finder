
-- =============================================================================
-- COMMISSION INVOICES: schema + RLS + RPCs
-- =============================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.commission_invoice_type AS ENUM ('marketplace', 'trading');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.commission_invoice_status AS ENUM ('to_invoice','invoiced','paid','disputed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.commission_sales_channel AS ENUM ('manual','online','mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- Global sequence for invoice numbering CMSN-YYYY-NNNNNN
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.commission_invoice_seq START 1;

CREATE OR REPLACE FUNCTION public.next_commission_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  n := nextval('public.commission_invoice_seq');
  RETURN 'CMSN-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
END $$;

-- =============================================================================
-- Commission VAT resolution per vendor country
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resolve_commission_vat_rate(_country_code text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(coalesce(_country_code, 'BE'))
    WHEN 'BE' THEN 21.00
    WHEN 'FR' THEN 20.00
    WHEN 'LU' THEN 17.00
    WHEN 'NL' THEN 21.00
    WHEN 'DE' THEN 19.00
    ELSE 21.00
  END;
$$;

-- =============================================================================
-- Table commission_invoices
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.commission_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  type public.commission_invoice_type NOT NULL,
  sales_channel public.commission_sales_channel NOT NULL DEFAULT 'online',
  status public.commission_invoice_status NOT NULL DEFAULT 'to_invoice',
  period_start date,
  period_end date,
  orders_count integer NOT NULL DEFAULT 0,
  lines_count integer NOT NULL DEFAULT 0,
  gmv_incl_vat_cents bigint NOT NULL DEFAULT 0,
  revenue_excl_vat_cents bigint NOT NULL DEFAULT 0,
  commission_excl_vat_cents bigint NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 21.00,
  vat_cents bigint NOT NULL DEFAULT 0,
  total_incl_vat_cents bigint NOT NULL DEFAULT 0,
  vendor_country_code text,
  invoiced_at timestamptz,
  due_date date,
  paid_at timestamptz,
  payment_reference text,
  dispute_reason text,
  cancelled_at timestamptz,
  cancelled_reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, order_id, type)
);

CREATE INDEX IF NOT EXISTS idx_cmsn_inv_vendor ON public.commission_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cmsn_inv_order ON public.commission_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_cmsn_inv_status ON public.commission_invoices(status);
CREATE INDEX IF NOT EXISTS idx_cmsn_inv_type ON public.commission_invoices(type);
CREATE INDEX IF NOT EXISTS idx_cmsn_inv_created ON public.commission_invoices(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_invoices TO authenticated;
GRANT ALL ON public.commission_invoices TO service_role;
GRANT USAGE ON SEQUENCE public.commission_invoice_seq TO authenticated, service_role;

ALTER TABLE public.commission_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission_invoices"
  ON public.commission_invoices
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Vendor read-only on their own commission invoices (used by future vendor screen)
CREATE POLICY "Vendors read own commission_invoices"
  ON public.commission_invoices
  FOR SELECT
  TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

-- Updated_at trigger (reuse existing helper)
CREATE TRIGGER trg_commission_invoices_updated_at
  BEFORE UPDATE ON public.commission_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- Table commission_invoice_lines
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.commission_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_invoice_id uuid NOT NULL REFERENCES public.commission_invoices(id) ON DELETE CASCADE,
  order_line_id uuid NOT NULL REFERENCES public.order_lines(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL,
  type public.commission_invoice_type NOT NULL,
  gmv_incl_vat_cents bigint NOT NULL DEFAULT 0,
  revenue_excl_vat_cents bigint NOT NULL DEFAULT 0,
  commission_excl_vat_cents bigint NOT NULL DEFAULT 0,
  commission_basis text,
  commission_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_line_id, type)
);

CREATE INDEX IF NOT EXISTS idx_cmsn_inv_lines_invoice ON public.commission_invoice_lines(commission_invoice_id);
CREATE INDEX IF NOT EXISTS idx_cmsn_inv_lines_order ON public.commission_invoice_lines(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_invoice_lines TO authenticated;
GRANT ALL ON public.commission_invoice_lines TO service_role;

ALTER TABLE public.commission_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission_invoice_lines"
  ON public.commission_invoice_lines
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Vendors read own commission_invoice_lines"
  ON public.commission_invoice_lines
  FOR SELECT
  TO authenticated
  USING (
    commission_invoice_id IN (
      SELECT ci.id FROM public.commission_invoices ci
      JOIN public.vendors v ON v.id = ci.vendor_id
      WHERE v.auth_user_id = auth.uid()
    )
  );

-- =============================================================================
-- View admin_commission_backlog_v
-- Toutes les order_lines facturables non encore rattachées à commission_invoice_lines
-- =============================================================================
CREATE OR REPLACE VIEW public.admin_commission_backlog_v
WITH (security_invoker = true)
AS
SELECT
  ol.id AS order_line_id,
  ol.order_id,
  o.order_number,
  o.created_at AS order_created_at,
  o.status AS order_status,
  o.payment_status,
  o.source AS order_source,
  CASE
    WHEN o.source = 'manual_admin' OR o.created_by_admin IS NOT NULL THEN 'manual'::public.commission_sales_channel
    ELSE 'online'::public.commission_sales_channel
  END AS sales_channel,
  ol.vendor_id,
  COALESCE(v.company_name, v.name) AS vendor_display_name,
  v.country_code AS vendor_country_code,
  ol.quantity,
  COALESCE(ol.commission_basis, 'ca') AS commission_basis,
  CASE
    WHEN COALESCE(ol.commission_basis, 'ca') = 'margin' THEN 'trading'::public.commission_invoice_type
    ELSE 'marketplace'::public.commission_invoice_type
  END AS type,
  ol.commission_rate,
  ROUND(COALESCE(ol.line_total_incl_vat, 0) * 100)::bigint AS gmv_incl_vat_cents,
  ROUND(COALESCE(ol.line_total_excl_vat, 0) * 100)::bigint AS revenue_excl_vat_cents,
  ROUND(COALESCE(ol.commission_amount, 0) * 100)::bigint AS commission_excl_vat_cents,
  to_char(date_trunc('month', o.created_at), 'YYYY-MM') AS period_month,
  EXTRACT(EPOCH FROM (now() - o.created_at)) / 86400 AS age_days
FROM public.order_lines ol
JOIN public.orders o ON o.id = ol.order_id
LEFT JOIN public.vendors v ON v.id = ol.vendor_id
WHERE o.is_forecast = false
  AND o.is_test = false
  AND o.hidden_from_list = false
  AND o.deleted_at IS NULL
  AND lower(o.status::text) NOT IN ('cancelled','canceled','refused','rejected','refunded','failed')
  AND COALESCE(ol.commission_amount, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.commission_invoice_lines cil
    WHERE cil.order_line_id = ol.id
  );

GRANT SELECT ON public.admin_commission_backlog_v TO authenticated;

-- =============================================================================
-- RPC: admin_commission_dashboard_kpis
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_commission_dashboard_kpis(
  _period_start date DEFAULT date_trunc('month', now())::date,
  _period_end date DEFAULT (date_trunc('month', now()) + interval '1 month - 1 day')::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH backlog AS (
    SELECT
      type,
      sales_channel,
      SUM(commission_excl_vat_cents) AS amount,
      COUNT(*) AS lines
    FROM public.admin_commission_backlog_v
    WHERE order_created_at::date BETWEEN _period_start AND _period_end
    GROUP BY type, sales_channel
  ),
  invoiced AS (
    SELECT
      type,
      sales_channel,
      status,
      SUM(commission_excl_vat_cents) AS amount,
      COUNT(*) AS invoices
    FROM public.commission_invoices
    WHERE created_at::date BETWEEN _period_start AND _period_end
    GROUP BY type, sales_channel, status
  )
  SELECT jsonb_build_object(
    'period_start', _period_start,
    'period_end', _period_end,
    'backlog', (SELECT jsonb_agg(to_jsonb(backlog.*)) FROM backlog),
    'invoiced', (SELECT jsonb_agg(to_jsonb(invoiced.*)) FROM invoiced),
    'totals', jsonb_build_object(
      'to_invoice_cents', COALESCE((SELECT SUM(amount) FROM backlog), 0),
      'invoiced_cents', COALESCE((SELECT SUM(amount) FROM invoiced WHERE status = 'invoiced'), 0),
      'paid_cents', COALESCE((SELECT SUM(amount) FROM invoiced WHERE status = 'paid'), 0),
      'disputed_cents', COALESCE((SELECT SUM(amount) FROM invoiced WHERE status = 'disputed'), 0),
      'trading_cents', COALESCE((SELECT SUM(amount) FROM backlog WHERE type = 'trading'), 0)
        + COALESCE((SELECT SUM(amount) FROM invoiced WHERE type = 'trading'), 0),
      'marketplace_cents', COALESCE((SELECT SUM(amount) FROM backlog WHERE type = 'marketplace'), 0)
        + COALESCE((SELECT SUM(amount) FROM invoiced WHERE type = 'marketplace'), 0),
      'manual_cents', COALESCE((SELECT SUM(amount) FROM backlog WHERE sales_channel = 'manual'), 0)
        + COALESCE((SELECT SUM(amount) FROM invoiced WHERE sales_channel = 'manual'), 0),
      'online_cents', COALESCE((SELECT SUM(amount) FROM backlog WHERE sales_channel = 'online'), 0)
        + COALESCE((SELECT SUM(amount) FROM invoiced WHERE sales_channel = 'online'), 0)
    )
  ) INTO result;

  RETURN result;
END $$;

-- =============================================================================
-- RPC: admin_commission_by_vendor
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_commission_by_vendor(
  _period_start date DEFAULT date_trunc('month', now())::date,
  _period_end date DEFAULT (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  _type public.commission_invoice_type DEFAULT NULL,
  _channel public.commission_sales_channel DEFAULT NULL
)
RETURNS TABLE(
  vendor_id uuid,
  vendor_display_name text,
  vendor_country_code text,
  orders_count bigint,
  lines_count bigint,
  gmv_incl_vat_cents bigint,
  revenue_excl_vat_cents bigint,
  commission_trading_cents bigint,
  commission_marketplace_cents bigint,
  commission_total_cents bigint,
  to_invoice_cents bigint,
  invoiced_cents bigint,
  paid_cents bigint,
  disputed_cents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH backlog AS (
    SELECT
      b.vendor_id,
      b.vendor_display_name,
      b.vendor_country_code,
      b.order_id,
      b.type,
      b.sales_channel,
      b.gmv_incl_vat_cents,
      b.revenue_excl_vat_cents,
      b.commission_excl_vat_cents
    FROM public.admin_commission_backlog_v b
    WHERE b.order_created_at::date BETWEEN _period_start AND _period_end
      AND (_type IS NULL OR b.type = _type)
      AND (_channel IS NULL OR b.sales_channel = _channel)
  ),
  invoiced AS (
    SELECT
      ci.vendor_id,
      ci.status,
      ci.type,
      ci.sales_channel,
      ci.commission_excl_vat_cents
    FROM public.commission_invoices ci
    WHERE ci.created_at::date BETWEEN _period_start AND _period_end
      AND (_type IS NULL OR ci.type = _type)
      AND (_channel IS NULL OR ci.sales_channel = _channel)
  ),
  agg AS (
    SELECT vendor_id, vendor_display_name, vendor_country_code,
      COUNT(DISTINCT order_id) AS orders_count,
      COUNT(*) AS lines_count,
      SUM(gmv_incl_vat_cents) AS gmv_incl_vat_cents,
      SUM(revenue_excl_vat_cents) AS revenue_excl_vat_cents,
      SUM(CASE WHEN type = 'trading' THEN commission_excl_vat_cents ELSE 0 END) AS commission_trading_cents,
      SUM(CASE WHEN type = 'marketplace' THEN commission_excl_vat_cents ELSE 0 END) AS commission_marketplace_cents,
      SUM(commission_excl_vat_cents) AS commission_total_cents,
      SUM(commission_excl_vat_cents) AS to_invoice_cents
    FROM backlog
    GROUP BY vendor_id, vendor_display_name, vendor_country_code
  ),
  inv_agg AS (
    SELECT vendor_id,
      SUM(CASE WHEN status = 'invoiced' THEN commission_excl_vat_cents ELSE 0 END) AS invoiced_cents,
      SUM(CASE WHEN status = 'paid' THEN commission_excl_vat_cents ELSE 0 END) AS paid_cents,
      SUM(CASE WHEN status = 'disputed' THEN commission_excl_vat_cents ELSE 0 END) AS disputed_cents
    FROM invoiced GROUP BY vendor_id
  )
  SELECT
    COALESCE(a.vendor_id, i.vendor_id),
    a.vendor_display_name,
    a.vendor_country_code,
    COALESCE(a.orders_count, 0),
    COALESCE(a.lines_count, 0),
    COALESCE(a.gmv_incl_vat_cents, 0),
    COALESCE(a.revenue_excl_vat_cents, 0),
    COALESCE(a.commission_trading_cents, 0),
    COALESCE(a.commission_marketplace_cents, 0),
    COALESCE(a.commission_total_cents, 0),
    COALESCE(a.to_invoice_cents, 0),
    COALESCE(i.invoiced_cents, 0),
    COALESCE(i.paid_cents, 0),
    COALESCE(i.disputed_cents, 0)
  FROM agg a
  FULL OUTER JOIN inv_agg i ON i.vendor_id = a.vendor_id
  ORDER BY COALESCE(a.commission_total_cents, 0) + COALESCE(i.invoiced_cents, 0) + COALESCE(i.paid_cents, 0) DESC;
END $$;

-- =============================================================================
-- RPC: admin_commission_by_month
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_commission_by_month(
  _from date DEFAULT (date_trunc('month', now()) - interval '11 month')::date,
  _to date DEFAULT (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  _type public.commission_invoice_type DEFAULT NULL
)
RETURNS TABLE(
  period_month text,
  trading_cents bigint,
  marketplace_cents bigint,
  total_cents bigint,
  orders_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH src AS (
    SELECT
      to_char(date_trunc('month', order_created_at), 'YYYY-MM') AS period_month,
      type,
      order_id,
      commission_excl_vat_cents
    FROM public.admin_commission_backlog_v
    WHERE order_created_at::date BETWEEN _from AND _to
      AND (_type IS NULL OR type = _type)
    UNION ALL
    SELECT
      to_char(date_trunc('month', created_at), 'YYYY-MM'),
      type, order_id, commission_excl_vat_cents
    FROM public.commission_invoices
    WHERE created_at::date BETWEEN _from AND _to
      AND (_type IS NULL OR type = _type)
  )
  SELECT
    src.period_month,
    SUM(CASE WHEN src.type = 'trading' THEN src.commission_excl_vat_cents ELSE 0 END),
    SUM(CASE WHEN src.type = 'marketplace' THEN src.commission_excl_vat_cents ELSE 0 END),
    SUM(src.commission_excl_vat_cents),
    COUNT(DISTINCT src.order_id)
  FROM src
  GROUP BY src.period_month
  ORDER BY src.period_month;
END $$;

-- =============================================================================
-- RPC: admin_create_commission_invoice
-- Crée une facture commission pour un vendeur+order+type à partir de order_line_ids
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_commission_invoice(
  _vendor_id uuid,
  _order_id uuid,
  _type public.commission_invoice_type,
  _order_line_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  v_country text;
  v_vat_rate numeric;
  v_channel public.commission_sales_channel;
  v_gmv bigint;
  v_rev bigint;
  v_com bigint;
  v_lines int;
  v_vat bigint;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _order_line_ids IS NULL OR array_length(_order_line_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no_lines';
  END IF;

  -- Country + VAT
  SELECT country_code INTO v_country FROM public.vendors WHERE id = _vendor_id;
  v_vat_rate := public.resolve_commission_vat_rate(v_country);

  -- Channel from order
  SELECT CASE
    WHEN o.source = 'manual_admin' OR o.created_by_admin IS NOT NULL THEN 'manual'::public.commission_sales_channel
    ELSE 'online'::public.commission_sales_channel
  END INTO v_channel
  FROM public.orders o WHERE o.id = _order_id;

  -- Aggregate from selected lines (only valid backlog rows)
  SELECT
    COALESCE(SUM(b.gmv_incl_vat_cents), 0),
    COALESCE(SUM(b.revenue_excl_vat_cents), 0),
    COALESCE(SUM(b.commission_excl_vat_cents), 0),
    COUNT(*)
  INTO v_gmv, v_rev, v_com, v_lines
  FROM public.admin_commission_backlog_v b
  WHERE b.order_line_id = ANY(_order_line_ids)
    AND b.vendor_id = _vendor_id
    AND b.order_id = _order_id
    AND b.type = _type;

  IF v_lines = 0 THEN
    RAISE EXCEPTION 'no_valid_lines';
  END IF;

  v_vat := ROUND(v_com * v_vat_rate / 100.0);

  INSERT INTO public.commission_invoices (
    invoice_number, vendor_id, order_id, type, sales_channel, status,
    orders_count, lines_count,
    gmv_incl_vat_cents, revenue_excl_vat_cents, commission_excl_vat_cents,
    vat_rate, vat_cents, total_incl_vat_cents, vendor_country_code,
    created_by
  ) VALUES (
    public.next_commission_invoice_number(),
    _vendor_id, _order_id, _type, v_channel, 'to_invoice',
    1, v_lines,
    v_gmv, v_rev, v_com,
    v_vat_rate, v_vat, v_com + v_vat, v_country,
    auth.uid()
  ) RETURNING id INTO new_id;

  INSERT INTO public.commission_invoice_lines (
    commission_invoice_id, order_line_id, order_id, type,
    gmv_incl_vat_cents, revenue_excl_vat_cents, commission_excl_vat_cents,
    commission_basis, commission_rate
  )
  SELECT
    new_id, b.order_line_id, b.order_id, b.type,
    b.gmv_incl_vat_cents, b.revenue_excl_vat_cents, b.commission_excl_vat_cents,
    b.commission_basis, b.commission_rate
  FROM public.admin_commission_backlog_v b
  WHERE b.order_line_id = ANY(_order_line_ids)
    AND b.vendor_id = _vendor_id
    AND b.order_id = _order_id
    AND b.type = _type;

  RETURN new_id;
END $$;

-- =============================================================================
-- RPC: state transitions
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_mark_commission_invoiced(
  _invoice_id uuid, _due_date date DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.commission_invoices
  SET status = 'invoiced', invoiced_at = now(),
      due_date = COALESCE(_due_date, (now() + interval '30 day')::date)
  WHERE id = _invoice_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_mark_commission_paid(
  _invoice_id uuid, _payment_reference text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.commission_invoices
  SET status = 'paid', paid_at = now(), payment_reference = _payment_reference
  WHERE id = _invoice_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_mark_commission_disputed(
  _invoice_id uuid, _reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.commission_invoices
  SET status = 'disputed', dispute_reason = _reason
  WHERE id = _invoice_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_commission_invoice(
  _invoice_id uuid, _reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.commission_invoices
  SET status = 'cancelled', cancelled_at = now(), cancelled_reason = _reason
  WHERE id = _invoice_id;
END $$;
