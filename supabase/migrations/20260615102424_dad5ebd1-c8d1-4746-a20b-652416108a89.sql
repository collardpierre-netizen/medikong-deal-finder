
CREATE TABLE public.vendor_buyer_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  buyer_account_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  default_mov numeric(12,2) NULL,
  default_moq integer NULL CHECK (default_moq IS NULL OR default_moq >= 1),
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX vendor_buyer_overrides_unique_active
  ON public.vendor_buyer_overrides(vendor_id, buyer_account_id)
  WHERE is_active;

CREATE INDEX vendor_buyer_overrides_vendor_idx ON public.vendor_buyer_overrides(vendor_id);
CREATE INDEX vendor_buyer_overrides_buyer_idx ON public.vendor_buyer_overrides(buyer_account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_buyer_overrides TO authenticated;
GRANT ALL ON public.vendor_buyer_overrides TO service_role;

ALTER TABLE public.vendor_buyer_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all vendor_buyer_overrides"
  ON public.vendor_buyer_overrides
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Vendors manage their own buyer overrides"
  ON public.vendor_buyer_overrides
  FOR ALL
  TO authenticated
  USING (vendor_id = public.current_vendor_id())
  WITH CHECK (vendor_id = public.current_vendor_id());

CREATE TRIGGER set_vendor_buyer_overrides_updated_at
  BEFORE UPDATE ON public.vendor_buyer_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
