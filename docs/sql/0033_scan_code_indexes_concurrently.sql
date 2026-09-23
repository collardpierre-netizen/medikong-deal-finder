-- Hors transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS products_cnk_normalized_expr_idx ON public.products (public.normalize_cnk(cnk_code));
CREATE INDEX CONCURRENTLY IF NOT EXISTS product_market_codes_code_normalized_expr_idx ON public.product_market_codes (public.normalize_cnk(code_value));
