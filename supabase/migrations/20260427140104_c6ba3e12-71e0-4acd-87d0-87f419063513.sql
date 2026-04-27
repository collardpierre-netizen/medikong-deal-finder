-- 1) Add purchase price column directly on offers (per-offer override)
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS purchase_price_excl_vat numeric(12,4);

COMMENT ON COLUMN public.offers.purchase_price_excl_vat IS
  'Vendor cost price (HTVA) for this offer. Used to compute net margin and commission. Optional — falls back to vendor_product_costs default.';

-- 2) Default cost per (vendor, product) — reused across all offers of the vendor for that product
CREATE TABLE IF NOT EXISTS public.vendor_product_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  default_purchase_price_excl_vat numeric(12,4) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_product_costs_vendor ON public.vendor_product_costs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_product_costs_product ON public.vendor_product_costs(product_id);

ALTER TABLE public.vendor_product_costs ENABLE ROW LEVEL SECURITY;

-- Vendor can read their own cost rows
CREATE POLICY "Vendors read own product costs"
  ON public.vendor_product_costs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_product_costs.vendor_id
        AND v.auth_user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- Vendor can insert their own cost rows
CREATE POLICY "Vendors insert own product costs"
  ON public.vendor_product_costs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_product_costs.vendor_id
        AND v.auth_user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- Vendor can update their own cost rows
CREATE POLICY "Vendors update own product costs"
  ON public.vendor_product_costs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_product_costs.vendor_id
        AND v.auth_user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- Vendor can delete their own cost rows
CREATE POLICY "Vendors delete own product costs"
  ON public.vendor_product_costs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_product_costs.vendor_id
        AND v.auth_user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

CREATE TRIGGER trg_vendor_product_costs_updated_at
  BEFORE UPDATE ON public.vendor_product_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();