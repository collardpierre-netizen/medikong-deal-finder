ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,4) NOT NULL DEFAULT 0.20;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cagnotte_eligible boolean
  GENERATED ALWAYS AS (commission_rate >= 0.12) STORED;

CREATE INDEX IF NOT EXISTS idx_products_cagnotte_eligible
  ON public.products(cagnotte_eligible) WHERE cagnotte_eligible = true;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cagnotte_eligible_ht numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cagnotte_earned numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cagnotte_used numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_total_ht numeric(10,2) DEFAULT 0;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot numeric(5,4),
  ADD COLUMN IF NOT EXISTS commission_ht numeric(10,2),
  ADD COLUMN IF NOT EXISTS cagnotte_eligible_snapshot boolean;

CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.settings TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_public_read" ON public.settings;
CREATE POLICY "settings_public_read" ON public.settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_admin_write" ON public.settings;
CREATE POLICY "settings_admin_write" ON public.settings
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.settings (key, value) VALUES
  ('cagnotte_rate', '0.02'::jsonb),
  ('cagnotte_min_commission_eligibility', '0.12'::jsonb),
  ('cagnotte_min_spend', '0.50'::jsonb),
  ('cagnotte_max_spend_pct', '0.30'::jsonb),
  ('cagnotte_vat_mode', '"payment"'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.cagnotte_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('earn','spend','expire','adjustment','refund')),
  amount_eur numeric(10,2) NOT NULL,
  balance_after numeric(10,2) NOT NULL,
  expires_on date,
  description text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cagnotte_user ON public.cagnotte_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cagnotte_expires ON public.cagnotte_ledger(expires_on)
  WHERE movement_type = 'earn' AND expires_on IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cagnotte_earn_unique_order
  ON public.cagnotte_ledger(order_id) WHERE movement_type = 'earn' AND order_id IS NOT NULL;

GRANT SELECT ON public.cagnotte_ledger TO authenticated;
GRANT ALL ON public.cagnotte_ledger TO service_role;

ALTER TABLE public.cagnotte_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_ledger" ON public.cagnotte_ledger;
CREATE POLICY "users_read_own_ledger" ON public.cagnotte_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_read_all_ledger" ON public.cagnotte_ledger;
CREATE POLICY "admins_read_all_ledger" ON public.cagnotte_ledger
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.cagnotte_ledger_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  RAISE EXCEPTION 'cagnotte_ledger est immuable (INSERT uniquement)';
END;
$fn$;

DROP TRIGGER IF EXISTS trg_cagnotte_ledger_immutable ON public.cagnotte_ledger;
CREATE TRIGGER trg_cagnotte_ledger_immutable
  BEFORE UPDATE OR DELETE ON public.cagnotte_ledger
  FOR EACH ROW EXECUTE FUNCTION public.cagnotte_ledger_immutable();

DROP VIEW IF EXISTS public.cagnotte_balance;
CREATE VIEW public.cagnotte_balance
WITH (security_invoker = true) AS
SELECT
  user_id,
  COALESCE(SUM(amount_eur), 0)::numeric(10,2) AS current_balance,
  MIN(expires_on) FILTER (WHERE movement_type = 'earn' AND expires_on >= CURRENT_DATE) AS next_expiry_date,
  COALESCE(SUM(amount_eur) FILTER (
    WHERE movement_type = 'earn'
      AND expires_on >= CURRENT_DATE
      AND expires_on <= CURRENT_DATE + INTERVAL '60 days'
  ), 0)::numeric(10,2) AS amount_expiring_soon
FROM public.cagnotte_ledger
GROUP BY user_id;

GRANT SELECT ON public.cagnotte_balance TO authenticated;
GRANT ALL ON public.cagnotte_balance TO service_role;

CREATE OR REPLACE FUNCTION public.insert_ledger_entry(
  p_user_id uuid,
  p_movement_type text,
  p_amount_eur numeric,
  p_description text,
  p_order_id uuid DEFAULT NULL,
  p_expires_on date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_balance numeric(10,2);
  v_id uuid;
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  SELECT COALESCE(SUM(amount_eur), 0) INTO v_balance
  FROM public.cagnotte_ledger WHERE user_id = p_user_id;

  v_balance := ROUND(v_balance + p_amount_eur, 2);

  IF v_balance < 0 THEN
    RAISE EXCEPTION 'Solde cagnotte insuffisant';
  END IF;

  INSERT INTO public.cagnotte_ledger (
    user_id, order_id, movement_type, amount_eur, balance_after, expires_on, description, created_by
  ) VALUES (
    p_user_id, p_order_id, p_movement_type, ROUND(p_amount_eur, 2), v_balance,
    p_expires_on, p_description, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.insert_ledger_entry(uuid, text, numeric, text, uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION public.insert_ledger_entry(uuid, text, numeric, text, uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.snapshot_order_commission(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_total_commission numeric(10,2);
  v_eligible_ht numeric(10,2);
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  UPDATE public.order_items oi
  SET commission_rate_snapshot = COALESCE(oi.commission_rate_snapshot, p.commission_rate),
      cagnotte_eligible_snapshot = COALESCE(oi.cagnotte_eligible_snapshot, p.cagnotte_eligible),
      commission_ht = ROUND(COALESCE(oi.line_total_excl_vat, 0)
        * COALESCE(oi.commission_rate_snapshot, p.commission_rate), 2)
  FROM public.products p
  WHERE oi.product_id = p.id AND oi.order_id = p_order_id;

  SELECT COALESCE(SUM(commission_ht), 0),
         COALESCE(SUM(line_total_excl_vat) FILTER (WHERE cagnotte_eligible_snapshot), 0)
  INTO v_total_commission, v_eligible_ht
  FROM public.order_items WHERE order_id = p_order_id;

  UPDATE public.orders
  SET commission_total_ht = v_total_commission,
      cagnotte_eligible_ht = v_eligible_ht
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'commission_total_ht', v_total_commission,
    'cagnotte_eligible_ht', v_eligible_ht
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snapshot_order_commission(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snapshot_order_commission(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_cagnotte_kpis(
  p_from date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_to date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_distributed numeric(12,2);
  v_used numeric(12,2);
  v_expired numeric(12,2);
  v_provision numeric(12,2);
  v_commissions numeric(12,2);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  SELECT
    COALESCE(SUM(amount_eur) FILTER (WHERE movement_type = 'earn'), 0),
    COALESCE(-SUM(amount_eur) FILTER (WHERE movement_type = 'spend'), 0),
    COALESCE(-SUM(amount_eur) FILTER (WHERE movement_type = 'expire'), 0)
  INTO v_distributed, v_used, v_expired
  FROM public.cagnotte_ledger
  WHERE created_at::date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(bal) FILTER (WHERE bal > 0), 0) INTO v_provision
  FROM (
    SELECT user_id, SUM(amount_eur) AS bal
    FROM public.cagnotte_ledger GROUP BY user_id
  ) b;

  SELECT COALESCE(SUM(commission_total_ht), 0) INTO v_commissions
  FROM public.orders
  WHERE created_at::date BETWEEN p_from AND p_to
    AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'distributed', v_distributed,
    'used', v_used,
    'expired', v_expired,
    'provision', v_provision,
    'commissions', v_commissions,
    'ratio_pct', CASE WHEN v_commissions > 0
      THEN ROUND(v_distributed / v_commissions * 100, 2) ELSE NULL END
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_cagnotte_kpis(date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_cagnotte_kpis(date, date) TO authenticated, service_role;

DO $mig$
DECLARE v_def text;
BEGIN
  SELECT pg_get_viewdef('public.products_with_country_stats_v'::regclass, true) INTO v_def;
  IF position('cagnotte_eligible' in v_def) = 0 THEN
    v_def := rtrim(btrim(v_def), ';');
    v_def := replace(v_def,
      'p.is_in_stock AS global_is_in_stock',
      'p.is_in_stock AS global_is_in_stock, p.cagnotte_eligible');
    EXECUTE 'CREATE OR REPLACE VIEW public.products_with_country_stats_v WITH (security_invoker = true) AS ' || v_def;
  END IF;
END $mig$;