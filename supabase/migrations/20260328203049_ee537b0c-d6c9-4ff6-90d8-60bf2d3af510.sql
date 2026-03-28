
-- User price watches: users save their purchase prices for products
CREATE TABLE public.user_price_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_price_excl_vat numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.user_price_watches ENABLE ROW LEVEL SECURITY;

-- Users manage their own price watches
CREATE POLICY "Users manage own price watches" ON public.user_price_watches
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all for intelligence
CREATE POLICY "Admins read all price watches" ON public.user_price_watches
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- Indexes
CREATE INDEX idx_user_price_watches_user ON public.user_price_watches(user_id);
CREATE INDEX idx_user_price_watches_product ON public.user_price_watches(product_id);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_user_price_watches
  BEFORE UPDATE ON public.user_price_watches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
