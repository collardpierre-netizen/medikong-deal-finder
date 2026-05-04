ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_orders_is_test ON public.orders(is_test) WHERE is_test = true;
COMMENT ON COLUMN public.orders.is_test IS 'True quand la commande a été payée via Stripe en mode test (clé sk_test_*) ou marquée test.';