-- Historique mensuel des prix grossistes. market_prices reste le prix courant (inchangé).
CREATE TABLE public.market_price_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES public.market_price_sources(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  period date NOT NULL CHECK (period = date_trunc('month', period)::date),
  price_excl_vat numeric NULL,
  price_incl_vat numeric NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, product_id, period)
);
CREATE INDEX market_price_history_product_idx ON public.market_price_history(product_id, period DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_price_history TO authenticated;
GRANT ALL ON public.market_price_history TO service_role;

ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage market_price_history" ON public.market_price_history
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));