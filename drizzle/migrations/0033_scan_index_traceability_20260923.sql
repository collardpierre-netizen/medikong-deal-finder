-- TRAÇABILITÉ — objets DÉJÀ APPLIQUÉS EN PROD le 23/09/2026 (index créés en CONCURRENTLY hors transaction, cf. docs/sql/0033).
-- Sur la base de prod : no-op (IF NOT EXISTS / OR REPLACE identique). Sur une reconstruction : recrée les objets.
CREATE OR REPLACE FUNCTION public.normalize_cnk(_v text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public AS $$
  SELECT NULLIF(regexp_replace(coalesce(_v, ''), '\D', '', 'g'), '')
$$;
CREATE INDEX IF NOT EXISTS products_cnk_normalized_expr_idx ON public.products (public.normalize_cnk(cnk_code));
CREATE INDEX IF NOT EXISTS product_market_codes_code_normalized_expr_idx ON public.product_market_codes (public.normalize_cnk(code_value));