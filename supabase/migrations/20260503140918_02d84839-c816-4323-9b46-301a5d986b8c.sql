ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pack_size_source text,
  ADD COLUMN IF NOT EXISTS pack_size_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_products_pack_size_null
  ON public.products (id)
  WHERE pack_size IS NULL OR pack_size = 1;

CREATE INDEX IF NOT EXISTS idx_products_gtin_packsize
  ON public.products (gtin)
  WHERE gtin IS NOT NULL AND pack_size > 1;