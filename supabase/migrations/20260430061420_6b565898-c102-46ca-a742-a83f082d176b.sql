ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS pack_size_override integer
  CHECK (pack_size_override IS NULL OR pack_size_override > 0);

COMMENT ON COLUMN public.offers.pack_size_override IS
  'Conditionnement du vendeur (nb d''unités par pack vendu). Prioritaire sur products.pack_size pour le calcul du prix unitaire.';