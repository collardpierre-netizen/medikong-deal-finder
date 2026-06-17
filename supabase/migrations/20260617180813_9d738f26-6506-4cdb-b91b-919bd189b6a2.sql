
-- ============================================================
-- VENDOR INVOICE PAYMENT — settings, rules, per-vendor split
-- ============================================================

-- 1. Extend payment_method_enum with "mixed" (some vendors card, others invoice)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'mixed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname='payment_method_enum')) THEN
    ALTER TYPE payment_method_enum ADD VALUE 'mixed';
  END IF;
END $$;

-- 2. Per-vendor payment columns on sub_orders
ALTER TABLE public.sub_orders
  ADD COLUMN IF NOT EXISTS payment_method payment_method_enum NOT NULL DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS payment_status payment_status_enum NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS invoice_net_days int,
  ADD COLUMN IF NOT EXISTS payment_due_date date,
  ADD COLUMN IF NOT EXISTS invoice_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_paid_marked_by uuid,
  ADD COLUMN IF NOT EXISTS invoice_reminder_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_last_reminder_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sub_orders_invoice_due
  ON public.sub_orders(payment_due_date)
  WHERE payment_method = 'invoice' AND payment_status IN ('pending','overdue');

-- 3. Vendor invoice payment settings (one row per vendor)
CREATE TABLE IF NOT EXISTS public.vendor_invoice_payment_settings (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  default_net_days int NOT NULL DEFAULT 30,
  allow_custom_net_days boolean NOT NULL DEFAULT false,
  min_net_days int NOT NULL DEFAULT 7,
  max_net_days int NOT NULL DEFAULT 60,
  min_order_amount_cents int NOT NULL DEFAULT 0,
  auto_remind_enabled boolean NOT NULL DEFAULT true,
  remind_days_before_due int NOT NULL DEFAULT 3,
  remind_days_after_due int[] NOT NULL DEFAULT ARRAY[1,7,14],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (default_net_days BETWEEN 1 AND 365),
  CHECK (min_net_days >= 1 AND max_net_days >= min_net_days),
  CHECK (min_order_amount_cents >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_invoice_payment_settings TO authenticated;
GRANT ALL ON public.vendor_invoice_payment_settings TO service_role;
ALTER TABLE public.vendor_invoice_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendor owners manage their invoice settings"
ON public.vendor_invoice_payment_settings FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid())
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid())
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Verified buyers can read enabled vendor invoice settings"
ON public.vendor_invoice_payment_settings FOR SELECT
TO authenticated
USING (enabled = true);

-- 4. Vendor invoice payment rules (whitelist criteria, first match wins by priority desc)
CREATE TABLE IF NOT EXISTS public.vendor_invoice_payment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  label text,
  enabled boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 100,
  -- Targeting
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_type customer_type,
  country_code text,
  min_amount_cents int NOT NULL DEFAULT 0,
  -- Terms granted when the rule matches
  net_days int NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (net_days BETWEEN 1 AND 365),
  CHECK (min_amount_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_vipr_vendor ON public.vendor_invoice_payment_rules(vendor_id, enabled, priority DESC);
CREATE INDEX IF NOT EXISTS idx_vipr_customer ON public.vendor_invoice_payment_rules(customer_id) WHERE customer_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_invoice_payment_rules TO authenticated;
GRANT ALL ON public.vendor_invoice_payment_rules TO service_role;
ALTER TABLE public.vendor_invoice_payment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendor owners manage their invoice rules"
ON public.vendor_invoice_payment_rules FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid())
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.auth_user_id = auth.uid())
  OR public.is_admin(auth.uid())
);

-- 5. updated_at triggers
CREATE TRIGGER trg_vips_updated_at BEFORE UPDATE ON public.vendor_invoice_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vipr_updated_at BEFORE UPDATE ON public.vendor_invoice_payment_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RPC : resolve invoice eligibility for a vendor x customer x amount
-- Returns { eligible boolean, net_days int, rule_id uuid, reason text }
CREATE OR REPLACE FUNCTION public.resolve_invoice_payment_eligibility(
  _vendor_id uuid,
  _customer_id uuid,
  _amount_cents int
) RETURNS TABLE (
  eligible boolean,
  net_days int,
  rule_id uuid,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  c record;
  r record;
BEGIN
  SELECT * INTO s FROM public.vendor_invoice_payment_settings WHERE vendor_id = _vendor_id;
  IF s IS NULL OR s.enabled IS NOT TRUE THEN
    RETURN QUERY SELECT false, NULL::int, NULL::uuid, 'vendor_disabled'::text;
    RETURN;
  END IF;
  IF _amount_cents < COALESCE(s.min_order_amount_cents, 0) THEN
    RETURN QUERY SELECT false, NULL::int, NULL::uuid, 'below_min_order_amount'::text;
    RETURN;
  END IF;

  SELECT id, customer_type, country_code INTO c FROM public.customers WHERE id = _customer_id;
  IF c IS NULL THEN
    RETURN QUERY SELECT false, NULL::int, NULL::uuid, 'unknown_customer'::text;
    RETURN;
  END IF;

  -- First matching rule wins (by priority desc)
  FOR r IN
    SELECT *
    FROM public.vendor_invoice_payment_rules
    WHERE vendor_id = _vendor_id
      AND enabled = true
      AND _amount_cents >= COALESCE(min_amount_cents, 0)
      AND (customer_id IS NULL OR customer_id = c.id)
      AND (customer_type IS NULL OR customer_type = c.customer_type)
      AND (country_code IS NULL OR country_code = c.country_code)
    ORDER BY priority DESC, created_at ASC
  LOOP
    RETURN QUERY SELECT true, r.net_days, r.id, 'matched_rule'::text;
    RETURN;
  END LOOP;

  RETURN QUERY SELECT false, NULL::int, NULL::uuid, 'no_matching_rule'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_invoice_payment_eligibility(uuid, uuid, int) TO authenticated, anon, service_role;

-- 7. Cron-friendly: mark overdue
CREATE OR REPLACE FUNCTION public.mark_overdue_vendor_invoices()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  UPDATE public.sub_orders
     SET payment_status = 'overdue', updated_at = now()
   WHERE payment_method = 'invoice'
     AND payment_status = 'pending'
     AND payment_due_date < CURRENT_DATE;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_overdue_vendor_invoices() TO service_role;
