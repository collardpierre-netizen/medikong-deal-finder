ALTER TABLE public.market_prices
ADD COLUMN IF NOT EXISTS stock_source text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS remise_pct numeric DEFAULT NULL;