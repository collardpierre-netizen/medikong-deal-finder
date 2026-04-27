-- 1. Table de trace
CREATE TABLE IF NOT EXISTS public.offer_margin_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- Inputs
  sell_price_excl_vat numeric(12,4) NOT NULL,
  purchase_price_excl_vat numeric(12,4),

  -- Snapshot de la config commission au moment du calcul
  commission_model text NOT NULL,
  commission_rate numeric(6,3),
  margin_split_pct numeric(6,3),
  fixed_commission_amount numeric(12,4),

  -- Outputs calculés
  commission_amount numeric(12,4) NOT NULL,
  commission_pct numeric(6,3),
  net_revenue numeric(12,4) NOT NULL,
  gross_margin numeric(12,4),
  net_margin numeric(12,4),
  net_margin_pct numeric(6,3),

  trigger_source text NOT NULL DEFAULT 'auto',
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_margin_snapshots_offer_recent
  ON public.offer_margin_snapshots (offer_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_offer_margin_snapshots_vendor_recent
  ON public.offer_margin_snapshots (vendor_id, computed_at DESC);

-- 2. RLS
ALTER TABLE public.offer_margin_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors read own margin snapshots" ON public.offer_margin_snapshots;
CREATE POLICY "Vendors read own margin snapshots"
  ON public.offer_margin_snapshots
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins read all margin snapshots" ON public.offer_margin_snapshots;
CREATE POLICY "Admins read all margin snapshots"
  ON public.offer_margin_snapshots
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role manages margin snapshots" ON public.offer_margin_snapshots;
CREATE POLICY "Service role manages margin snapshots"
  ON public.offer_margin_snapshots
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Trigger function : snapshot automatique au changement de prix/achat
CREATE OR REPLACE FUNCTION public.snapshot_offer_margin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_model text;
  v_rate numeric;
  v_split numeric;
  v_fixed numeric;
  v_sell numeric := COALESCE(NEW.price_excl_vat, 0);
  v_cost numeric := NEW.purchase_price_excl_vat;
  v_gross numeric;
  v_commission numeric := 0;
  v_net numeric;
  v_netm numeric;
BEGIN
  -- Skip si rien de pertinent n'a changé
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.price_excl_vat, -1) = COALESCE(NEW.price_excl_vat, -1)
       AND COALESCE(OLD.purchase_price_excl_vat, -1) = COALESCE(NEW.purchase_price_excl_vat, -1) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT
    COALESCE(commission_model, 'flat_percentage'),
    commission_rate,
    margin_split_pct,
    fixed_commission_amount
  INTO v_model, v_rate, v_split, v_fixed
  FROM public.vendors
  WHERE id = NEW.vendor_id;

  -- Calcul commission selon modèle
  IF v_model = 'flat_percentage' THEN
    v_commission := ROUND(v_sell * COALESCE(v_rate, 0) / 100.0, 4);
  ELSIF v_model = 'margin_split' THEN
    v_gross := GREATEST(v_sell - COALESCE(v_cost, 0), 0);
    v_commission := ROUND(v_gross * GREATEST(100 - COALESCE(v_split, 0), 0) / 100.0, 4);
  ELSIF v_model = 'fixed_amount' THEN
    v_commission := COALESCE(v_fixed, 0);
  END IF;
  v_commission := GREATEST(v_commission, 0);

  v_net := v_sell - v_commission;
  v_netm := CASE WHEN v_cost IS NOT NULL THEN v_sell - v_cost - v_commission ELSE NULL END;

  INSERT INTO public.offer_margin_snapshots (
    offer_id, vendor_id, product_id,
    sell_price_excl_vat, purchase_price_excl_vat,
    commission_model, commission_rate, margin_split_pct, fixed_commission_amount,
    commission_amount, commission_pct,
    net_revenue, gross_margin, net_margin, net_margin_pct,
    trigger_source
  ) VALUES (
    NEW.id, NEW.vendor_id, NEW.product_id,
    v_sell, v_cost,
    v_model, v_rate, v_split, v_fixed,
    v_commission,
    CASE WHEN v_sell > 0 THEN ROUND(v_commission / v_sell * 100, 3) ELSE 0 END,
    v_net,
    CASE WHEN v_cost IS NOT NULL THEN v_sell - v_cost ELSE NULL END,
    v_netm,
    CASE WHEN v_netm IS NOT NULL AND v_sell > 0 THEN ROUND(v_netm / v_sell * 100, 3) ELSE NULL END,
    CASE WHEN auth.role() = 'service_role' THEN 'system' ELSE 'price_update' END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_offer_margin ON public.offers;
CREATE TRIGGER trg_snapshot_offer_margin
  AFTER INSERT OR UPDATE OF price_excl_vat, purchase_price_excl_vat
  ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_offer_margin();