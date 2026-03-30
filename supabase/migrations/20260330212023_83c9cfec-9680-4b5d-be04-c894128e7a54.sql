
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'BE',
  price_excl_vat NUMERIC(10,2) NOT NULL,
  price_incl_vat NUMERIC(10,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_history_product_date ON public.price_history(product_id, recorded_at DESC);
CREATE INDEX idx_price_history_country ON public.price_history(country_code);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Price history publicly readable"
  ON public.price_history FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins manage price_history"
  ON public.price_history FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));
