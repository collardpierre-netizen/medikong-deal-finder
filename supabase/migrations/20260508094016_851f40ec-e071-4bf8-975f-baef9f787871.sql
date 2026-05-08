-- pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding column on categories (1536 dims = text-embedding-3-small)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ivfflat cosine index (small list count since N1 cats are few; safe default)
CREATE INDEX IF NOT EXISTS idx_categories_embedding_cosine
  ON public.categories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- Read-only view exposing active products with primary category
CREATE OR REPLACE VIEW public.catalog_products
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.name,
  p.slug,
  p.brand_id,
  p.primary_category_id,
  CASE WHEN p.is_active THEN 'active'::text ELSE 'inactive'::text END AS status,
  p.is_active,
  p.created_at,
  p.updated_at
FROM public.products p;

COMMENT ON VIEW public.catalog_products IS
  'Vue lecture seule des produits exposant primary_category_id + status (mappé sur is_active). Utilisée par le helper embeddings et outils admin de mapping.';