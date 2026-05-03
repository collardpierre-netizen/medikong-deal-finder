
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pack_size_validated boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_pack_size_check
  ON public.products (id)
  WHERE pack_size IS NOT NULL AND pack_size_validated = false;
