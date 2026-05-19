-- 1) Extension pg_trgm (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) Index GIN trigram sur lower(products.name)
--    Permet à `lower(products.name) ILIKE '%' || lower($1) || '%'`
--    d'utiliser l'index dès que $1 fait ≥ 3 caractères.
--    NB: CREATE INDEX CONCURRENTLY n'est pas supporté dans une migration
--    transactionnelle Supabase — on reste sur CREATE INDEX classique.
CREATE INDEX IF NOT EXISTS idx_products_name_lower_trgm
  ON public.products
  USING gin (lower(name) gin_trgm_ops);